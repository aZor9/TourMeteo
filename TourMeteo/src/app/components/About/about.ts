import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface AccordionSection {
  id: string;
  title: string;
  icon: string;
  open: boolean;
}

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './about.html'
})
export class AboutComponent {
  title = 'À propos';

  sections: AccordionSection[] = [
    { id: 'features',     title: 'Fonctionnalités',               icon: '🚀', open: true  },
    { id: 'gpx',          title: 'Import GPX & Export',            icon: '🗺️', open: false },
    { id: 'apis',         title: 'APIs utilisées',                 icon: '🔌', open: false },
    { id: 'architecture', title: 'Architecture des composants',    icon: '🏗️', open: false },
    { id: 'legend',       title: 'Légende des emoji weathercode',  icon: '🌈', open: false },
    { id: 'notes',        title: 'Remarques & confidentialité',    icon: '🔒', open: false },
    { id: 'contact',      title: 'Contact',                       icon: '✉️', open: false },
  ];

  toggle(section: AccordionSection): void {
    section.open = !section.open;
  }

  expandAll(): void {
    this.sections.forEach(s => s.open = true);
  }

  collapseAll(): void {
    this.sections.forEach(s => s.open = false);
  }
}
