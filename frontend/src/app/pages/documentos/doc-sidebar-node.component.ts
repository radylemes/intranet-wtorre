import { Component, forwardRef, input, output } from '@angular/core';
import { CategoriaDocumento } from '../../models/documento.model';

@Component({
  selector: 'app-doc-sidebar-node',
  standalone: true,
  imports: [forwardRef(() => DocSidebarNodeComponent)],
  templateUrl: './doc-sidebar-node.component.html',
  styleUrl: './doc-sidebar-node.component.scss',
})
export class DocSidebarNodeComponent {
  readonly item = input.required<CategoriaDocumento>();
  readonly depth = input(0);
  readonly ativoId = input<number | null>(null);
  readonly recolhidos = input<Set<number>>(new Set());
  readonly select = output<CategoriaDocumento>();
  readonly toggle = output<number>();

  temFilhos(): boolean {
    return (this.item().children?.length ?? 0) > 0;
  }

  recolhido(): boolean {
    return this.recolhidos().has(this.item().id);
  }

  iconFor(item: CategoriaDocumento): string {
    return item.icone || 'folder';
  }
}
