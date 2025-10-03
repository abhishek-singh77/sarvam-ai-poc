import { Component, Input, Output, EventEmitter, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface AccordionItem {
  id: string;
  title: string;
  description?: string;
  status?: string;
  timestamp?: string;
  data?: any;
  expanded?: boolean;
  disabled?: boolean;
}

@Component({
  selector: 'app-accordion',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './accordion.component.html',
  styleUrls: ['./accordion.component.css']
})
export class AccordionComponent {
  @Input() items: AccordionItem[] = [];
  @Input() allowMultiple: boolean = false;
  @Input() showIcons: boolean = true;
  @Input() customHeaderTemplate?: TemplateRef<any>;
  @Input() customContentTemplate?: TemplateRef<any>;
  
  @Output() itemToggled = new EventEmitter<{ item: AccordionItem; expanded: boolean }>();
  @Output() itemClicked = new EventEmitter<AccordionItem>();

  toggleItem(item: AccordionItem): void {
    if (item.disabled) return;

    const wasExpanded = item.expanded;
    
    if (!this.allowMultiple) {
      // Close all other items
      this.items.forEach(i => {
        if (i.id !== item.id) {
          i.expanded = false;
        }
      });
    }
    
    // Toggle current item
    item.expanded = !wasExpanded;
    
    this.itemToggled.emit({ item, expanded: item.expanded });
    this.itemClicked.emit(item);
  }

  getItemIcon(item: AccordionItem): string {
    if (item.status === 'completed') return '✅';
    if (item.status === 'in_progress') return '⏳';
    if (item.status === 'error') return '❌';
    if (item.status === 'pending') return '⏸️';
    return '📋';
  }

  getItemStatusClass(item: AccordionItem): string {
    const baseClasses = 'border rounded-lg transition-all duration-200';
    
    if (item.disabled) {
      return `${baseClasses} opacity-50 cursor-not-allowed`;
    }
    
    if (item.status === 'completed') {
      return `${baseClasses} border-green-200 bg-green-50`;
    }
    if (item.status === 'in_progress') {
      return `${baseClasses} border-blue-200 bg-blue-50`;
    }
    if (item.status === 'error') {
      return `${baseClasses} border-red-200 bg-red-50`;
    }
    if (item.status === 'pending') {
      return `${baseClasses} border-yellow-200 bg-yellow-50`;
    }
    
    return `${baseClasses} border-gray-200 bg-white`;
  }

  getItemHeaderClass(item: AccordionItem): string {
    const baseClasses = 'flex flex-col sm:flex-row sm:items-center sm:justify-between p-2 sm:p-3 transition-all duration-200';
    
    if (item.disabled) {
      return `${baseClasses} cursor-not-allowed`;
    }
    
    return `${baseClasses} cursor-pointer hover:bg-gray-50`;
  }

  formatTimestamp(timestamp?: string): string {
    if (!timestamp) return '';
    
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
    } catch {
      return timestamp;
    }
  }
}
