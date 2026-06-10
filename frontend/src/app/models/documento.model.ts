export interface CategoriaDocumento {
  id: number;
  nome: string;
  slug: string;
  descricao?: string | null;
  icone?: string | null;
  parent_id?: number | null;
  ordem?: number;
  ativo?: boolean;
  documentos_count?: number;
  children: CategoriaDocumento[];
}

export interface Documento {
  id: number;
  categoria_id: number;
  titulo: string;
  descricao?: string | null;
  nome_original: string;
  mime: string;
  extensao: string;
  tamanho_bytes: number;
  criado_em: string;
  atualizado_em?: string;
}

export interface CategoriaDocumentoPayload {
  nome: string;
  descricao?: string | null;
  icone?: string | null;
  parent_id?: number | null;
  ordem?: number;
  ativo?: boolean;
}

export interface DocumentoUpdatePayload {
  titulo?: string;
  descricao?: string | null;
  categoria_id?: number;
}

export interface CategoriaReorderItem {
  id: number;
  parent_id: number | null;
  ordem: number;
}

export const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'xlsx', 'pptx', 'png', 'jpg', 'jpeg', 'zip'];
export const MAX_UPLOAD_MB = 50;
export const PREVIEWABLE_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg'];

export const CATEGORIA_ICONES = [
  { value: 'folder', label: 'Pasta' },
  { value: 'shield', label: 'Escudo' },
  { value: 'brand', label: 'Marca' },
  { value: 'cap', label: 'Capelo' },
  { value: 'file', label: 'Doc' },
] as const;
