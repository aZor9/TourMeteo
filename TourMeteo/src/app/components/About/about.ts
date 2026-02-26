import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface AccordionSection {
  id: string;
  title: string;
  icon: string;
  group: 'user' | 'dev';
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
    // Utilisateurs (non-dev)
    { id: 'features',     title: 'Fonctionnalités',               icon: '🚀', group: 'user', open: false  },
    { id: 'gpx',          title: 'Import GPX & Export',            icon: '🗺️', group: 'user', open: false },
    { id: 'notes',        title: 'Remarques & confidentialité',    icon: '🔒', group: 'user', open: false },
    { id: 'contact',      title: 'Contact',                       icon: '✉️', group: 'user', open: false },
    
    // Développeurs
    { id: 'legend',       title: 'Légende des emoji weathercode',  icon: '🌈', group: 'dev', open: false },
    { id: 'apis',         title: 'APIs utilisées',                 icon: '🔌', group: 'dev',  open: false },
    { id: 'architecture', title: 'Architecture des composants',    icon: '🏗️', group: 'dev',  open: false },
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
