import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { PointService } from '../../services/point.service';
import { ImportResult } from '../../models/geojson';
import { SweetAlertService } from '../../services/sweet-alert.service';

@Component({
  selector: 'app-import-export',
  templateUrl: './import-export.html',
  styleUrl: './import-export.css',
  imports: [CommonModule],
})
export class ImportExport {
  // Services
  public readonly pointService = inject(PointService);
  private readonly sweetAlertService = inject(SweetAlertService);

  //Signals
  public importResult = signal<ImportResult | null>(null);
  public accepts = signal<string>('.geojson,.json');
  public features = computed(() => this.pointService.features());

  public async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      
      try {
        this.importResult.set(
          await this.pointService.importGeoJSON(file)
        );
        this.sweetAlertService.html(
          'Import Summary',
          `
            <div class="container mb-4 overflow-auto">
              <div class="d-flex align-items-center mb-2">
                <span class="text-success me-2">Imported: ${this.importResult()?.imported ?? 0}</span>
              </div>
              <div class="d-flex align-items-center mb-2">
                <span class="text-danger me-2">Discarded: ${this.importResult()?.discarded ?? 0}</span>
              </div>
              ${this.importResult()?.errors?.length ? `
                <div class="mt-2 text-start">
                  <ul class="list-unstyled small text-muted mb-0">
                    ${this.importResult()!.errors.map(error => `<li>${error}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}
            </div>
          `
        );
      } catch (error) {
        this.importResult.set({
          imported: 0,
          discarded: 0,
          errors: [`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
        });
      }
    }
  }

  public exportGeoJSON(): void {
    const data = this.pointService.exportGeoJSON();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pois-export.geojson';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  public clearData(): void {
    this.sweetAlertService.confirm(
      'Clear',
      'Are you sure you want to clear all data?'
    ).then((response) => {
      if(response.isConfirmed) {
        this.pointService.clearData();
        this.importResult.set(null);
        this.sweetAlertService.showAlert(
          'Clear',
          '¡data successfully deleted!'
        )
      }
    })
  }


}
