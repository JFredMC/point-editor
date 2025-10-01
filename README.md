# POINT Editor
A basic POI (Point of Interest) editor on a map using Angular 20, TypeScript, and MapLibre GL JS.

## 🌟 Features

- POI Management: Create, edit, delete, and visualize points on the map
- Smart Search: Real-time filtering by name and category
- Import/Export: GeoJSON file support
- Local Persistence: Automatic localStorage saving
- Responsive Design: Bootstrap-based adaptive interface

## 📋 Environment Requirements
- Node.js: v22.15.1 or higher
- Angular CLI: v20.3.3
- Yarn: v1.22.22
- Browser: ES2022 and WebGL compatible

## 🚀 Installation & Development
1. Clone the repository: `git clone https://github.com/JFredMC/point-editor.git`
2. Access the project directory: `cd point-editor`
3. Install dependencies: `yarn install`
4. Run the application: `ng serve`
5. Open in browser: `http://localhost:4200`
  
## 🏗️ Architecture Decisions

    1. Framework & Technologies
        - Angular 20: Chosen for its robust ecosystem, strong typing, and excellent tooling
        - Zoneless: Implemented without Zone.js for better performance and granular change detection control
        - Signals: Extensive use of Angular Signals for reactive state management
        - MapLibre GL JS: Open-source alternative to Mapbox GL JS with excellent performance and compatibility

    2. Design Patterns

        - Reactive Services: Centralized state management using services with Signals
        - Component Composition: Modular architecture with reusable components
        - Separation of Concerns:
        - PointService: Data management and business logic
        - MapService: Map interaction control
        - Components: User presentation and interaction

    3. State Management
    - Reactive state using Signals
        private featuresSignal = signal<GeoJSONFeature[]>([]);
        public filteredFeatures = computed(() => {});

## ✅ Current Architecture Advantages
    - Performance: Signals + Zoneless provides efficient updates
    - Type Safety: TypeScript throughout the project for reliability
    - Maintainability: Well-structured, easily extensible code
    - User Experience: Responsive interface with real-time search

## ⚠️ Accepted Compromises
    1. Local Persistence:

        - Advantage: Simplicity and offline functionality
        - Disadvantage: Limited by browser storage size

    2. MapLibre Dependency:

    - Advantage: Open-source and powerful
    - Disadvantage: Learning curve for advanced extensions

## 🚧 Known Limitations
    1. Current
        - File Size: Limited by browser memory for very large GeoJSON files
        - Custom Icons: Basic category icon implementation
        - Label Collisions: Map labels may overlap at low zoom levels
        - Basic Validation: GeoJSON validation limited to basic structure

    2. Technical
        - Maximum ~10,000 points for optimal performance
        - Requires WebGL enabled in browser
        - Internet connection required for map tiles

## 🔮 Potential Future Improvements
    1. High Priority

        - Backend Integration: REST API for server persistence
        - Real-time Collaboration: WebSockets for collaborative editing

    2. Medium Priority

        - Additional Formats: Support for KML, GPX, Shapefile
        - Advanced Styling: Complete map style customization
        - Plugin System: Extensible architecture for custom features

    3. Low Priority
        - Change History: Undo/redo system
        - Image Export: Map capture as PNG/PDF
        - Spatial Analysis: Measurement and analysis tools

## 🗂️ Project Structure
    src/
    ├── app/
    │   ├── components/
    │   │   ├── map/           # Main map component
    │   │   ├── import-export/ # File management
    │   │   └── search/        # Search and filtering
    │   ├── services/
    │   │   ├── point.service.ts    # Data management
    │   │   └── map.service.ts      # Map control
    │   │   └── sweet-alert.service.ts      # Alerts management
    │   └── types/
    │       └── geojson.ts     # geojson types
    │       └── map.ts         # map types
    │       └── search.ts     # search types
    │       └── select.ts     # select types
    🤝 Contributing
    Fork the project


## 📄 License
Distributed under the MIT License. See LICENSE for more information.