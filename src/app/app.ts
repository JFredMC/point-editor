import { Component } from '@angular/core';
import { Map } from './components/map/map';
import { ImportExport } from './components/import-export/import-export';

@Component({
  selector: 'app-root',
  imports: [Map, ImportExport],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected title = 'point-editor';
}
