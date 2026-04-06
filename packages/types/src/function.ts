export interface FunctionParam {
  name: string;
  type: string;
}

export interface FunctionInfo {
  id: string;
  name: string;
  filePath: string;
  line: number;
  column: number;
  params: FunctionParam[];
  returnType: string;
  jsdoc: string | null;
  sourcePreview: string;
  lastModified: number;
}
