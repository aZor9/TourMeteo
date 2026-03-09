import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { FeatureFlagService, FeatureFlags } from '../../service/feature-flag.service';

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
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './about.html'
})
export class AboutComponent {
  title = 'À propos';

  /** Hidden dev mode: tap version badge 5 times to reveal */
  devTapCount = 0;
  showDevOptions = false;
  flags: FeatureFlags;

  sections: AccordionSection[] = [
    // Utilisateurs (non-dev)
    { id: 'features',     title: 'Fonctionnalités',               icon: '🚀', group: 'user', open: false  },
    { id: 'gpx',          title: 'Import GPX & Export',            icon: '🗺️', group: 'user', open: false },
    { id: 'notes',        title: 'Confidentialité',               icon: '🔒', group: 'user', open: false },
    { id: 'legal',        title: 'Mentions légales & RGPD',       icon: '⚖️', group: 'user', open: false },
    { id: 'contact',      title: 'Contact',                       icon: '✉️', group: 'user', open: false },

    // Développeurs — masqués sauf si mode dev activé
    { id: 'legend',       title: 'Légende des emoji weathercode',  icon: '🌈', group: 'dev', open: false },
    { id: 'apis',         title: 'APIs utilisées',                 icon: '🔌', group: 'dev',  open: false },
    { id: 'architecture', title: 'Architecture des composants',    icon: '🏗️', group: 'dev',  open: false },
    { id: 'devtools',     title: 'Options développeur',            icon: '🔧', group: 'dev',  open: false },
  ];

  /** Returns only the sections that should be displayed */
  get visibleSections(): AccordionSection[] {
    return this.sections.filter(s => s.group === 'user' || this.showDevOptions);
  }

  constructor(private featureFlags: FeatureFlagService) {
    this.flags = this.featureFlags.getAll();
  }

  toggle(section: AccordionSection): void {
    section.open = !section.open;
  }

  expandAll(): void {
    this.visibleSections.forEach(s => s.open = true);
  }

  collapseAll(): void {
    this.sections.forEach(s => s.open = false);
  }

  /** Tap the version badge to unlock dev options */
  onVersionTap(): void {
    this.devTapCount++;
    if (this.devTapCount >= 5) {
      this.showDevOptions = true;
    }
  }

  toggleFlag(flag: keyof FeatureFlags): void {
    this.featureFlags.toggle(flag);
    this.flags = this.featureFlags.getAll();
  }
}
