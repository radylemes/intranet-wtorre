import { Documento } from '../../models/documento.model';

export function iconeExtensao(ext: string): string {
  const map: Record<string, string> = {
    pdf: 'pdf',
    docx: 'doc',
    xlsx: 'xls',
    pptx: 'ppt',
    png: 'img',
    jpg: 'img',
    jpeg: 'img',
    zip: 'zip',
  };
  return map[ext] || 'file';
}

export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function filtrarDocumentos(docs: Documento[], busca: string): Documento[] {
  const q = busca.trim().toLowerCase();
  if (!q) return docs;
  return docs.filter(
    (d) =>
      d.titulo.toLowerCase().includes(q) ||
      (d.descricao || '').toLowerCase().includes(q) ||
      d.nome_original.toLowerCase().includes(q)
  );
}
