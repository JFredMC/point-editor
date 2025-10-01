import { Component, inject, model, OnInit, output, signal } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { GeoJSONFeature, IProperty, PointFormData, PointFormModalData } from '../../models/geojson';
import { CommonModule } from '@angular/common';
import { PointService } from '../../services/point.service';
import { ISelect } from '../../models/select.interface';

@Component({
  selector: 'app-point-form-modal',
  templateUrl: './point-form-modal.html',
  styleUrl: './point-form-modal.css',
  imports: [CommonModule, ReactiveFormsModule]
})
export class PointFormModal implements OnInit {
  // Services
  private readonly fb = inject(FormBuilder);
  private readonly pointService = inject(PointService);

  // Input/Output
  public data = model.required<PointFormModalData>();
  save = output<PointFormData>();
  cancel = output<void>();

  // Form
  pointForm!: FormGroup;

  // Categories list
  categoriesList = signal<ISelect[]>(
    this.pointService.features().map((feature) => ({
      value: feature.properties.category,
      text: feature.properties.category,
    }))
  );

  ngOnInit() {
    if (this.data().mode === 'add') {
      this.initializeForm();
    } else if (this.data().mode === 'edit' && this.data().feature) {
      this.initializeForm(this.data().feature?.properties);
    }
  }

  private initializeForm(property?: IProperty): void {
    this.pointForm = this.fb.group({
      name: [property?.name, [Validators.required, Validators.minLength(2)]],
      category: [property?.category, Validators.required]
    });
  }

  public onSave(): void {
    if (this.pointForm.valid) {
      this.save.emit(this.pointForm.value);
    } else {
      this.markFormGroupTouched();
    }
  }

  public onCancel(): void {
    this.cancel.emit();
  }

  private markFormGroupTouched(): void {
    Object.keys(this.pointForm.controls).forEach(key => {
      this.pointForm.get(key)?.markAsTouched();
    });
  }


  isFieldInvalid(fieldName: string): boolean {
    const field = this.pointForm.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }

  getFieldError(fieldName: string): string {
    const field = this.pointForm.get(fieldName);
    if (field?.errors) {
      if (field.errors['required']) return 'This field is required';
      if (field.errors['minlength']) return 'Minimum 2 characters required';
    }
    return '';
  }
}
