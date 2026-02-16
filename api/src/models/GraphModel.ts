import { promises as fs } from 'fs';
import path from 'path';

type NodeType =
    | 'service'
    | 'class'
    | 'controller'
    | 'component'
    | 'repository'
    | 'method'
    | 'endpoint'
    | 'external';

type EdgeType = 'contains' | 'calls' | 'depends_on' | 'http';

type GraphNode = {
    id: string;
    type: NodeType;
    label: string;
    fullPath?: string;
    metadata?: Record<string, unknown>;
};

type GraphEdge = {
    source: string;
    target: string;
    type: EdgeType;
};

type EndpointInfo = {
    httpMethod: string;
    path: string;
};

type AnalysisResults = {
    root: string;
    summary: {
        javaFiles: number;
        classes: number;
        methods: number;
        endpoints: number;
        flows: number;
    };
    nodes: GraphNode[];
    edges: GraphEdge[];
    plantUml: string;
};

type ParsedClass = {
    fqn: string;
    className: string;
    filePath: string;
    packageName: string;
    kind: NodeType;
    basePath: string;
    isFeignClient: boolean;
    feignName?: string;
    feignUrl?: string;
    imports: Map<string, string>;
    fieldTypesByVar: Map<string, string>;
    methods: ParsedMethod[];
};

type ParsedMethod = {
    id: string;
    name: string;
    paramsCount: number;
    body: string;
    endpoint?: EndpointInfo;
};

export class GraphModel {
    private lastResults: AnalysisResults | null = null;

    async analyzeMicroservice(microservicePath: string): Promise<AnalysisResults> {
        const root = path.resolve(microservicePath);
        const stat = await fs.stat(root).catch(() => null);
        if (!stat || !stat.isDirectory()) {
            throw new Error(`Invalid microservicePath: ${microservicePath}`);
        }

        const javaFiles = await this.collectJavaFiles(root);
        const classes = await this.parseJavaClasses(javaFiles);

        const nodes = new Map<string, GraphNode>();
        const edges: GraphEdge[] = [];
        const edgeKeys = new Set<string>();

        const addNode = (node: GraphNode) => {
            if (!nodes.has(node.id)) {
                nodes.set(node.id, node);
            }
        };

        const addEdge = (edge: GraphEdge) => {
            const key = `${edge.source}|${edge.type}|${edge.target}`;
            if (!edgeKeys.has(key)) {
                edgeKeys.add(key);
                edges.push(edge);
            }
        };

        const serviceId = `service:${root.replace(/\\/g, '/')}`;
        addNode({
            id: serviceId,
            type: 'service',
            label: path.basename(root) || root,
            fullPath: root
        });

        const classIndex = new Map<string, ParsedClass>();
        for (const cls of classes) {
            classIndex.set(cls.fqn, cls);
            addNode({
                id: this.classNodeId(cls.fqn),
                type: cls.kind,
                label: cls.className,
                fullPath: cls.filePath,
                metadata: {
                    packageName: cls.packageName,
                    feignName: cls.feignName,
                    feignUrl: cls.feignUrl
                }
            });
            addEdge({
                source: serviceId,
                target: this.classNodeId(cls.fqn),
                type: 'contains'
            });
        }

        for (const cls of classes) {
            for (const method of cls.methods) {
                addNode({
                    id: method.id,
                    type: 'method',
                    label: `${cls.className}.${method.name}(${method.paramsCount})`,
                    fullPath: cls.filePath
                });
                addEdge({
                    source: this.classNodeId(cls.fqn),
                    target: method.id,
                    type: 'contains'
                });

                if (method.endpoint) {
                    const endpointPath = this.joinHttpPaths(cls.basePath, method.endpoint.path);
                    const endpointId = this.endpointNodeId(method.endpoint.httpMethod, endpointPath);
                    addNode({
                        id: endpointId,
                        type: 'endpoint',
                        label: `${method.endpoint.httpMethod} ${endpointPath}`,
                        metadata: {
                            class: cls.fqn,
                            method: method.name
                        }
                    });
                    addEdge({
                        source: this.classNodeId(cls.fqn),
                        target: endpointId,
                        type: 'contains'
                    });
                    addEdge({
                        source: endpointId,
                        target: method.id,
                        type: 'calls'
                    });

                    if (cls.isFeignClient) {
                        const target = this.buildFeignTarget(cls, endpointPath);
                        const externalId = `external:${target}`;
                        addNode({
                            id: externalId,
                            type: 'external',
                            label: `${method.endpoint.httpMethod} ${target}`
                        });
                        addEdge({
                            source: method.id,
                            target: externalId,
                            type: 'http'
                        });
                    }
                }

                // Same-class calls: methodName(...)
                const localCallRegex = /(^|[^.\w])([A-Za-z_]\w*)\s*\(/g;
                let localMatch: RegExpExecArray | null;
                while ((localMatch = localCallRegex.exec(method.body)) !== null) {
                    const calledName = localMatch[2];
                    if (this.isLanguageKeyword(calledName) || calledName === method.name) {
                        continue;
                    }
                    const targetMethod = cls.methods.find((m) => m.name === calledName);
                    if (targetMethod) {
                        addEdge({
                            source: method.id,
                            target: targetMethod.id,
                            type: 'calls'
                        });
                    }
                }

                // Qualified calls: varOrClass.method(...)
                const qualifiedCallRegex = /([A-Za-z_]\w*)\s*\.\s*([A-Za-z_]\w*)\s*\(/g;
                let qMatch: RegExpExecArray | null;
                while ((qMatch = qualifiedCallRegex.exec(method.body)) !== null) {
                    const qualifier = qMatch[1];
                    const calledName = qMatch[2];

                    let targetClassFqn: string | null = null;

                    if (cls.fieldTypesByVar.has(qualifier)) {
                        targetClassFqn = cls.fieldTypesByVar.get(qualifier) || null;
                    } else if (/^[A-Z]/.test(qualifier)) {
                        targetClassFqn = this.resolveTypeFqn(qualifier, cls.packageName, cls.imports);
                    } else if (qualifier === 'this') {
                        targetClassFqn = cls.fqn;
                    }

                    if (!targetClassFqn) {
                        continue;
                    }

                    const sourceClassId = this.classNodeId(cls.fqn);
                    const targetClassId = this.classNodeId(targetClassFqn);
                    addNode({
                        id: targetClassId,
                        type: classIndex.has(targetClassFqn) ? classIndex.get(targetClassFqn)!.kind : 'class',
                        label: targetClassFqn.split('.').pop() || targetClassFqn
                    });
                    addEdge({
                        source: sourceClassId,
                        target: targetClassId,
                        type: 'depends_on'
                    });

                    const targetParsedClass = classIndex.get(targetClassFqn);
                    if (targetParsedClass) {
                        const targetMethod = targetParsedClass.methods.find((m) => m.name === calledName);
                        if (targetMethod) {
                            addEdge({
                                source: method.id,
                                target: targetMethod.id,
                                type: 'calls'
                            });

                            if (targetParsedClass.isFeignClient && targetMethod.endpoint) {
                                const endpointPath = this.joinHttpPaths(
                                    targetParsedClass.basePath,
                                    targetMethod.endpoint.path
                                );
                                const target = this.buildFeignTarget(targetParsedClass, endpointPath);
                                const externalId = `external:${target}`;
                                addNode({
                                    id: externalId,
                                    type: 'external',
                                    label: `${targetMethod.endpoint.httpMethod} ${target}`
                                });
                                addEdge({
                                    source: method.id,
                                    target: externalId,
                                    type: 'http'
                                });
                            }
                        }
                    }
                }

                for (const target of this.extractHttpTargets(method.body)) {
                    const externalId = `external:${target}`;
                    addNode({
                        id: externalId,
                        type: 'external',
                        label: target
                    });
                    addEdge({
                        source: method.id,
                        target: externalId,
                        type: 'http'
                    });
                }
            }
        }

        const classCount = Array.from(nodes.values()).filter((n) => n.id.startsWith('class:')).length;
        const methodCount = Array.from(nodes.values()).filter((n) => n.type === 'method').length;
        const endpointCount = Array.from(nodes.values()).filter((n) => n.type === 'endpoint').length;
        const flowCount = edges.filter((e) => e.type === 'calls' || e.type === 'depends_on' || e.type === 'http').length;

        this.lastResults = {
            root,
            summary: {
                javaFiles: javaFiles.length,
                classes: classCount,
                methods: methodCount,
                endpoints: endpointCount,
                flows: flowCount
            },
            nodes: Array.from(nodes.values()),
            edges,
            plantUml: this.buildPlantUml(Array.from(nodes.values()), edges)
        };

        return this.lastResults;
    }

    getResults(): AnalysisResults | null {
        return this.lastResults;
    }

    getPlantUml(): string {
        if (!this.lastResults) {
            return '@startuml\ntitle No analysis results yet\n@enduml';
        }
        return this.lastResults.plantUml;
    }

    private async collectJavaFiles(root: string): Promise<string[]> {
        const files: string[] = [];
        const ignore = new Set(['.git', 'node_modules', 'target', 'build', '.idea', '.gradle']);

        const walk = async (dirPath: string): Promise<void> => {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                if (ignore.has(entry.name)) {
                    continue;
                }
                const fullPath = path.join(dirPath, entry.name);
                if (entry.isDirectory()) {
                    await walk(fullPath);
                } else if (entry.isFile() && entry.name.endsWith('.java')) {
                    files.push(fullPath);
                }
            }
        };

        await walk(root);
        return files;
    }

    private async parseJavaClasses(javaFiles: string[]): Promise<ParsedClass[]> {
        const classes: ParsedClass[] = [];

        for (const filePath of javaFiles) {
            const content = await fs.readFile(filePath, 'utf-8');
            const packageName = this.extractPackage(content);
            const imports = this.extractImports(content);

            const classMatch = content.match(/\b(class|interface)\s+([A-Za-z_]\w*)/);
            if (!classMatch) {
                continue;
            }

            const className = classMatch[2];
            const fqn = packageName ? `${packageName}.${className}` : className;
            const kind = this.detectClassKind(content);
            const basePath = this.extractClassBasePath(content);
            const feignConfig = this.extractFeignClientConfig(content);
            const fieldTypesByVar = this.extractFieldTypes(content, packageName, imports);
            const methods = this.extractMethods(content, fqn, !!feignConfig);

            classes.push({
                fqn,
                className,
                filePath,
                packageName,
                kind,
                basePath,
                isFeignClient: !!feignConfig,
                feignName: feignConfig?.name,
                feignUrl: feignConfig?.url,
                imports,
                fieldTypesByVar,
                methods
            });
        }

        return classes;
    }

    private extractPackage(content: string): string {
        const match = content.match(/^\s*package\s+([a-zA-Z_][\w.]*)\s*;/m);
        return match ? match[1] : '';
    }

    private extractImports(content: string): Map<string, string> {
        const imports = new Map<string, string>();
        const importRegex = /^\s*import\s+([a-zA-Z_][\w.]*)\s*;/gm;
        let match: RegExpExecArray | null;
        while ((match = importRegex.exec(content)) !== null) {
            const fqn = match[1];
            const short = fqn.split('.').pop();
            if (short) {
                imports.set(short, fqn);
            }
        }
        return imports;
    }

    private detectClassKind(content: string): NodeType {
        if (/@RestController\b|@Controller\b/.test(content)) {
            return 'controller';
        }
        if (/@Repository\b/.test(content)) {
            return 'repository';
        }
        if (/@Service\b/.test(content)) {
            return 'service';
        }
        if (/@Component\b|@FeignClient\b/.test(content)) {
            return 'component';
        }
        return 'class';
    }

    private extractClassBasePath(content: string): string {
        const classMatch = content.match(/\b(class|interface)\s+[A-Za-z_]\w*/);
        if (!classMatch || classMatch.index === undefined) {
            return '';
        }
        const prelude = content.slice(Math.max(0, classMatch.index - 600), classMatch.index);
        return this.extractPathFromRequestMapping(prelude);
    }

    private extractFeignClientConfig(content: string): { name?: string; url?: string } | null {
        const match = content.match(/@FeignClient\s*\(([\s\S]*?)\)/);
        if (!match) {
            return null;
        }
        const args = match[1];
        const name =
            this.firstMatch(args, /(?:name|value)\s*=\s*"([^"]+)"/) ||
            this.firstMatch(args, /"([^"]+)"/) ||
            undefined;
        const url = this.firstMatch(args, /url\s*=\s*"([^"]+)"/) || undefined;
        return { name, url };
    }

    private extractFieldTypes(content: string, packageName: string, imports: Map<string, string>): Map<string, string> {
        const map = new Map<string, string>();
        const fieldRegex =
            /(?:private|protected|public)\s+(?:static\s+)?(?:final\s+)?([A-Z][A-Za-z0-9_<>]*)\s+([a-zA-Z_]\w*)\s*(?:=[^;]+)?;/g;
        let match: RegExpExecArray | null;
        while ((match = fieldRegex.exec(content)) !== null) {
            const rawType = match[1].replace(/<.*>$/, '');
            const varName = match[2];
            const resolved = this.resolveTypeFqn(rawType, packageName, imports);
            map.set(varName, resolved);
        }
        return map;
    }

    private extractMethods(content: string, classFqn: string, keepDeclarations: boolean): ParsedMethod[] {
        const methods: ParsedMethod[] = [];
        const signatureRegex =
            /(?:public|protected|private)?\s*(?:default\s+)?(?:static\s+)?(?:final\s+)?[A-Za-z_][\w<>\[\], ?]*\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*(\{|;)/g;

        let match: RegExpExecArray | null;
        while ((match = signatureRegex.exec(content)) !== null) {
            const methodName = match[1];
            const endingToken = match[3];
            if (this.isLanguageKeyword(methodName)) {
                continue;
            }

            if (endingToken === ';' && !keepDeclarations) {
                continue;
            }

            const paramsRaw = match[2].trim();
            const paramsCount = paramsRaw ? paramsRaw.split(',').length : 0;

            const startIndex = match.index;
            const prelude = content.slice(Math.max(0, startIndex - 500), startIndex);
            const endpoint = this.extractEndpointInfo(prelude);

            let body = '';
            if (endingToken === '{') {
                const bodyStart = signatureRegex.lastIndex - 1;
                const bodyEnd = this.findMatchingBrace(content, bodyStart);
                if (bodyEnd <= bodyStart) {
                    continue;
                }
                body = content.slice(bodyStart + 1, bodyEnd);
                signatureRegex.lastIndex = bodyEnd + 1;
            }

            const methodId = `method:${classFqn}#${methodName}/${paramsCount}`;
            methods.push({
                id: methodId,
                name: methodName,
                paramsCount,
                body,
                endpoint: endpoint || undefined
            });
        }

        return methods;
    }

    private extractEndpointInfo(prelude: string): EndpointInfo | null {
        const simple: Array<{ annotation: string; method: string }> = [
            { annotation: 'GetMapping', method: 'GET' },
            { annotation: 'PostMapping', method: 'POST' },
            { annotation: 'PutMapping', method: 'PUT' },
            { annotation: 'DeleteMapping', method: 'DELETE' },
            { annotation: 'PatchMapping', method: 'PATCH' }
        ];

        for (const item of simple) {
            const annotationRegex = new RegExp(`@${item.annotation}\\s*(?:\\(([^)]*)\\))?`);
            const match = prelude.match(annotationRegex);
            if (!match) {
                continue;
            }
            const args = match[1] || '';
            const p = this.extractPathFromMappingArgs(args);
            return { httpMethod: item.method, path: p };
        }

        const requestMapping = prelude.match(/@RequestMapping\s*(?:\(([^)]*)\))?/);
        if (requestMapping) {
            const args = requestMapping[1] || '';
            const method = this.firstMatch(args, /RequestMethod\.(GET|POST|PUT|DELETE|PATCH)/) || 'ANY';
            const p = this.extractPathFromMappingArgs(args);
            return { httpMethod: method, path: p };
        }

        return null;
    }

    private extractPathFromRequestMapping(text: string): string {
        const match = text.match(/@RequestMapping\s*(?:\(([^)]*)\))?/);
        if (!match) {
            return '';
        }
        return this.extractPathFromMappingArgs(match[1] || '');
    }

    private extractPathFromMappingArgs(args: string): string {
        const named =
            this.firstMatch(args, /(?:value|path)\s*=\s*"([^"]*)"/) ||
            this.firstMatch(args, /(?:value|path)\s*=\s*\{\s*"([^"]*)"/);
        if (named) {
            return this.normalizeHttpPath(named);
        }

        const firstString = this.firstMatch(args, /"([^"]*)"/);
        return this.normalizeHttpPath(firstString || '');
    }

    private joinHttpPaths(basePath: string, pathPart: string): string {
        const base = this.normalizeHttpPath(basePath);
        const part = this.normalizeHttpPath(pathPart);
        if (!base) {
            return part || '/';
        }
        if (!part || part === '/') {
            return base;
        }
        return this.normalizeHttpPath(`${base}/${part}`);
    }

    private normalizeHttpPath(p: string): string {
        const raw = (p || '').trim();
        if (!raw) {
            return '';
        }
        const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
        return withSlash.replace(/\/{2,}/g, '/');
    }

    private extractHttpTargets(body: string): string[] {
        const targets = new Set<string>();

        const directUrlRegex = /(https?:\/\/[^\s"'`]+|lb:\/\/[A-Za-z0-9._-]+)/g;
        let match: RegExpExecArray | null;
        while ((match = directUrlRegex.exec(body)) !== null) {
            targets.add(match[1]);
        }

        const quotedArgRegex = /\(\s*"([^"]+)"\s*[),]/g;
        while ((match = quotedArgRegex.exec(body)) !== null) {
            const value = match[1];
            if (/^(https?:\/\/|lb:\/\/)/.test(value)) {
                targets.add(value);
            }
        }

        return Array.from(targets);
    }

    private buildFeignTarget(cls: ParsedClass, endpointPath: string): string {
        if (cls.feignUrl) {
            const base = cls.feignUrl.replace(/\/+$/, '');
            return `${base}${endpointPath}`;
        }
        const serviceName = cls.feignName || cls.className;
        return `feign://${serviceName}${endpointPath}`;
    }

    private findMatchingBrace(content: string, startIndex: number): number {
        let depth = 0;
        for (let i = startIndex; i < content.length; i += 1) {
            const char = content[i];
            if (char === '{') {
                depth += 1;
            } else if (char === '}') {
                depth -= 1;
                if (depth === 0) {
                    return i;
                }
            }
        }
        return -1;
    }

    private resolveTypeFqn(typeName: string, packageName: string, imports: Map<string, string>): string {
        if (typeName.includes('.')) {
            return typeName;
        }
        if (imports.has(typeName)) {
            return imports.get(typeName)!;
        }
        return packageName ? `${packageName}.${typeName}` : typeName;
    }

    private classNodeId(fqn: string): string {
        return `class:${fqn}`;
    }

    private endpointNodeId(httpMethod: string, p: string): string {
        return `endpoint:${httpMethod}:${p}`;
    }

    private firstMatch(text: string, regex: RegExp): string {
        const m = text.match(regex);
        return m ? m[1] : '';
    }

    private isLanguageKeyword(name: string): boolean {
        return new Set([
            'if',
            'for',
            'while',
            'switch',
            'catch',
            'return',
            'new',
            'throw',
            'super',
            'this',
            'try',
            'else',
            'do',
            'case'
        ]).has(name);
    }

    private buildPlantUml(nodes: GraphNode[], edges: GraphEdge[]): string {
        const lines: string[] = [];
        lines.push('@startuml');
        lines.push('skinparam shadowing false');
        lines.push('left to right direction');
        lines.push('hide empty members');
        lines.push('title Java Call Flow');

        for (const node of nodes) {
            const alias = this.nodeAlias(node.id);
            const label = this.escapeLabel(node.label);
            const stereotype = this.stereotypeForNode(node.type);
            lines.push(`class "${label}" as ${alias} <<${stereotype}>>`);
        }

        for (const edge of edges) {
            const source = this.nodeAlias(edge.source);
            const target = this.nodeAlias(edge.target);
            const label = this.edgeLabel(edge.type);
            lines.push(`${source} --> ${target} : ${label}`);
        }

        lines.push('@enduml');
        return lines.join('\n');
    }

    private nodeAlias(id: string): string {
        return `N_${id.replace(/[^a-zA-Z0-9_]/g, '_')}`;
    }

    private edgeLabel(type: EdgeType): string {
        switch (type) {
            case 'contains':
                return 'contains';
            case 'calls':
                return 'calls';
            case 'depends_on':
                return 'depends_on';
            case 'http':
                return 'http';
            default:
                return 'flow';
        }
    }

    private stereotypeForNode(type: NodeType): string {
        switch (type) {
            case 'controller':
                return 'Controller';
            case 'service':
                return 'Service';
            case 'repository':
                return 'Repository';
            case 'endpoint':
                return 'Endpoint';
            case 'method':
                return 'Method';
            case 'external':
                return 'External';
            case 'component':
                return 'Component';
            case 'class':
            default:
                return 'Class';
        }
    }

    private escapeLabel(label: string): string {
        return label.replace(/"/g, "'");
    }
}
