import { Component, OnInit, OnDestroy, ElementRef, inject, viewChild, model, computed, effect } from '@angular/core';
import { MapService } from '../../services/map.service';
import { PointService } from '../../services/point.service';
import { SweetAlertService } from '../../services/sweet-alert.service';
import { PointFormData, PointFormModalData } from '../../types/geojson';
import { PointFormModal } from '../point-form-modal/point-form-modal';
import { Search } from '../search/search';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-map',
  templateUrl: './map.html',
  styleUrl: './map.css',
  imports: [PointFormModal, Search, CommonModule],
})
export class Map implements OnInit, OnDestroy {
  // Reference to the map container using viewChild
  public mapContainer = viewChild.required<ElementRef<HTMLElement>>('map');

  // Injected services
  private readonly mapService = inject(MapService);
  private readonly pointService = inject(PointService);
  private readonly sweetAlertService = inject(SweetAlertService);

  // Signals for the component status
  public showModal = model(false);
  public modalData = model<PointFormModalData | null>(null);
  public features = computed(() => this.pointService.filteredFeatures());
  public selectedFeature = computed(() => this.mapService.selectedFeature());
  public clickCoordinates = computed(() => this.mapService.clickCoordinates());

  constructor() {
    effect(() => {
      const filtered = this.features();
      const map = this.mapService.getMap();
      
      if (map) {
        this.mapService.updateMapFeatures(filtered);
        if (filtered.length > 0) {
          setTimeout(() => {
            this.mapService.fitToFeatures(filtered);
          });
        }
      }
    });
  }

  /**
   * Initializes the map when loading the component
  */
  ngOnInit(): void {
    this.mapService.initializeMap(this.mapContainer().nativeElement);
  }

  ngOnDestroy(): void {
    this.mapService.destroyMap();
  }

  /**
   * Opens the modal for adding a new point using the last clicked coordinates.
  */
  public showAddModal(): void {
    const coordinates = this.clickCoordinates();
    if (!coordinates) return;

    this.modalData.set({
      mode: 'add',
      coordinates: coordinates
    });
    this.showModal.set(true);
  }

  /**
   * Displays the modal for editing an existing point.
   * Uses the feature currently selected on the map.
   */
  public showEditModal(): void {
    const feature = this.mapService.selectedFeature();
    if (feature) {
      this.modalData.set({
        mode: 'edit',
        feature,
      });
      this.showModal.set(true);
    } else {
      // Optional: Add user feedback if no feature is selected
      this.sweetAlertService.showAlert('Info', 'Please select a point to edit.');
    }
  }

  /**
   * Handles saving a point from the modal form.
   * Adds a new feature if in 'add' mode or updates an existing one if in 'edit' mode.
   * Displays a success alert and clears the modal/selection afterward.
   * @param formData - The data from the point form.
   */
  public onSavePoint(formData: PointFormData): void {
    const modalData = this.modalData();
    if (!modalData) return;

    if (modalData.mode === 'add' && modalData.coordinates) {
      this.pointService.addFeature(modalData.coordinates, formData);
      this.sweetAlertService.showAlert('Success', 'Point added successfully!');
    } else if (modalData.mode === 'edit' && modalData.feature) {
      this.pointService.updateFeature(modalData.feature.properties['_featureId']!, { properties: formData });
      this.sweetAlertService.showAlert('Success', 'Point updated successfully!');
    }

    this.clearModal();
    this.mapService.clearSelection();
  }

  /**
   * Handles canceling the modal.
   * Clears the modal data and hides it.
   */
  public onCancelPoint(): void {
    this.clearModal();
  }

  /**
   * Deletes the currently selected point after user confirmation.
   * Displays a confirmation dialog and, if confirmed, removes the feature,
   * clears the selection, and shows a success alert.
   */
  public deletePoint(): void {
    const feature = this.mapService.selectedFeature();
    if (feature) {
      this.sweetAlertService
        .confirm('Delete Point', `Are you sure you want to delete "${feature.properties.name}"?`)
        .then((response) => {
          if (response.isConfirmed) {
            this.pointService.removeFeature(feature.properties._featureId);
            this.mapService.clearSelection();
            this.sweetAlertService.showAlert('Deleted', 'Point deleted successfully!');
          }
        });
    } else {
      // Optional: Add user feedback if no feature is selected
      this.sweetAlertService.showAlert('Info', 'Please select a point to delete.');
    }
  }

  /**
   * Clears the current map selection.
   */
  public clearSelection(): void {
    this.mapService.clearSelection();
  }

  /**
   * Returns the Bootstrap Icon class based on the point's category.
   * Used for displaying category-specific icons in the UI.
   * @param category - The category of the point (optional).
   * @returns The corresponding icon class or a default if no match.
   */
  public getIconClassByCategory(category?: string): string {
    switch (category) {
      case 'mall':
        return 'bi bi-building';
      case 'stadium':
        return 'bi bi-trophy';
      case 'station':
        return 'bi bi-train-front';
      case 'bus_terminal':
        return 'bi bi-bus-front';
      case 'landmark':
        return 'bi bi-geo-alt';
      case 'viewpoint':
        return 'bi bi-binoculars';
      case 'square':
        return 'bi bi-square';
      case 'park':
        return 'bi bi-tree';
      case 'airport':
        return 'bi bi-airplane';
      default:
        return 'bi bi-geo';
    }
  }

  /**
   * Clears the modal by hiding it and resetting its data.
   * Private helper method used internally.
   */
  private clearModal(): void {
    this.showModal.set(false);
    this.modalData.set(null);
  }
}
