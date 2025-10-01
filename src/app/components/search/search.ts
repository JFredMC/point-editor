import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PointService } from '../../services/point.service';


@Component({
  selector: 'app-search',
  templateUrl: './search.html',
  styleUrl: './search.css',
  imports: [FormsModule],
})
export class Search {
  private pointService = inject(PointService);

  // Signals from service
  public searchTerm = this.pointService.searchTermSignal.asReadonly();
  public searchCategory = this.pointService.searchCategorySignal.asReadonly();
  public availableCategories = this.pointService.availableCategories;
  public filteredFeatures = this.pointService.filteredFeatures;

  // Computed signal for active filters
  public hasActiveFilters = computed(() => 
    this.searchTerm().length > 0 || this.searchCategory().length > 0
  );

  public onSearchTermChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.pointService.setSearchTerm(input.value);
  }

  public onSearchCategoryChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.pointService.setSearchCategory(select.value);
  }

  public clearSearchTerm(): void {
    this.pointService.setSearchTerm('');
  }

  public clearSearchCategory(): void {
    this.pointService.setSearchCategory('');
  }

  public clearAllFilters(): void {
    this.pointService.clearSearch();
  }
}
