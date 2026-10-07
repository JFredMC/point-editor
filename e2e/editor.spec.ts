import { expect, Page, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

async function ready(page: Page) {
  await page.goto('./');
  await page.waitForFunction(() => {
    const m = (window as unknown as { __pointEditorMap?: { isStyleLoaded(): boolean; getLayer(id: string): unknown } }).__pointEditorMap;
    return !!m && !!m.getLayer('points');
  });
}

async function openPanel(page: Page) {
  const handle = page.locator('.sheet-handle');
  if ((await handle.isVisible()) && (await handle.getAttribute('aria-expanded')) === 'false') await handle.click();
}

/** Clicks an empty spot of the map (relative position inside the canvas). */
async function clickMap(page: Page, fx = 0.5, fy = 0.6) {
  const box = (await page.locator('.map canvas').boundingBox())!;
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
}

async function loadSamples(page: Page) {
  await openPanel(page);
  await page.getByRole('button', { name: 'Cargar ejemplos' }).first().click();
  await expect(page.locator('.items li')).toHaveCount(12);
}

test.beforeEach(async ({ page }) => {
  await page.route('https://nominatim.openstreetmap.org/**', (route) =>
    route.fulfill({
      json: [{ name: 'Parque Simón Bolívar', display_name: 'Parque Simón Bolívar, Bogotá, Colombia', lat: '4.658', lon: '-74.093', boundingbox: ['4.65', '4.67', '-74.10', '-74.08'] }],
    }),
  );
});

test('muestra el estado vacío, la marca y el título', async ({ page }) => {
  await ready(page);
  await expect(page).toHaveTitle(/Point Editor/);
  await openPanel(page);
  await expect(page.getByRole('heading', { name: 'Tu mapa está vacío' })).toBeVisible();
  const brand = page.getByRole('link', { name: /JFredDev/ });
  await expect(brand).toHaveAttribute('href', 'https://jfredmc.github.io/portfolio/');
  await expect(brand).toHaveAttribute('target', '_blank');
  await expect(brand).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(page.locator('.maplibregl-ctrl-attrib')).toContainText('OpenStreetMap');
});

test('carga ejemplos, filtra por categoría y texto', async ({ page }) => {
  await ready(page);
  await loadSamples(page);
  await page.getByRole('button', { name: /^Museo 1$/ }).click();
  await expect(page.locator('.items li')).toHaveCount(1);
  await page.getByRole('button', { name: 'Todas' }).click();
  await page.getByLabel('Filtrar mis puntos').fill('cartagena');
  await expect(page.locator('.items li')).toHaveCount(2);
  await page.getByRole('button', { name: 'Quitar filtros' }).click();
  await expect(page.locator('.items li')).toHaveCount(12);
});

test('agrega, edita, elimina y deshace; persiste al recargar', async ({ page }) => {
  await ready(page);
  await clickMap(page);
  await expect(page.getByRole('heading', { name: 'Nuevo punto' })).toBeVisible();
  await page.getByRole('button', { name: 'Agregar punto' }).click();
  await expect(page.getByText('Ponle un nombre al punto.')).toBeVisible();
  await page.getByLabel('Nombre').fill('Mi café favorito');
  await page.getByLabel('Descripción').fill('Abre a las 7');
  await page.getByLabel('Categoría').fill('Comida');
  await page.getByRole('button', { name: 'Color #f87171' }).click();
  await page.getByRole('button', { name: 'Agregar punto' }).click();
  await openPanel(page);
  await expect(page.locator('.items')).toContainText('Mi café favorito');

  await page.locator('.item', { hasText: 'Mi café favorito' }).click();
  await page.getByLabel('Nombre').fill('Café renovado');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.locator('.items')).toContainText('Café renovado');

  await page.locator('.item', { hasText: 'Café renovado' }).click();
  await page.getByRole('button', { name: 'Eliminar punto' }).click();
  await expect(page.getByRole('heading', { name: 'Tu mapa está vacío' })).toBeVisible();
  await page.locator('.toast', { hasText: 'eliminado' }).getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.locator('.items')).toContainText('Café renovado');

  await page.reload();
  await openPanel(page);
  await expect(page.locator('.items')).toContainText('Café renovado');
  await expect(page.locator('.items')).toContainText('Comida');
});

test('mide distancias', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: /Medir/ }).click();
  await clickMap(page, 0.3, 0.55);
  await clickMap(page, 0.7, 0.55);
  await expect(page.getByTestId('measure-total')).toHaveText(/\d.*(km|m)$/);
  await page.getByRole('button', { name: 'Salir' }).click();
  await expect(page.getByTestId('measure-total')).toHaveCount(0);
});

test('busca un lugar y lo agrega', async ({ page }) => {
  await ready(page);
  const input = page.getByLabel('Buscar un lugar en el mapa');
  await input.fill('simon bolivar');
  await input.press('Enter');
  await page.getByRole('option', { name: /Parque Simón Bolívar/ }).click();
  await expect(page.getByLabel('Nombre')).toHaveValue('Parque Simón Bolívar');
  await page.getByRole('button', { name: 'Agregar punto' }).click();
  await openPanel(page);
  await expect(page.locator('.items')).toContainText('Parque Simón Bolívar');
});

test('exporta GeoJSON e importa CSV', async ({ page }) => {
  await ready(page);
  await loadSamples(page);
  await page.getByRole('button', { name: 'Importar y exportar' }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: 'Exportar GeoJSON' }).click()]);
  expect(download.suggestedFilename()).toMatch(/^puntos-\d{4}-\d{2}-\d{2}\.geojson$/);
  const data = JSON.parse(readFileSync((await download.path())!, 'utf8'));
  expect(data.features).toHaveLength(12);

  await page.locator('input[type=file]').setInputFiles({
    name: 'nuevos.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('nombre;latitud;longitud;categoria\nBiblioteca Virgilio Barco;4,657;-74,089;Biblioteca\nFila mala;;;\n'),
  });
  await expect(page.locator('.toast').first()).toContainText('1 puntos importados, 1 descartados');
  await expect(page.locator('.items li')).toHaveCount(13);
});

test('cambia de tema y muestra los atajos', async ({ page }) => {
  await ready(page);
  const before = await page.locator('html').getAttribute('data-theme');
  await page.getByRole('button', { name: /Cambiar a tema/ }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', before!);
  await page.getByRole('button', { name: 'Atajos de teclado' }).click();
  await expect(page.getByRole('dialog', { name: 'Atajos de teclado' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('atajos: A agrega, Ctrl+Z deshace', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Atajos de teclado solo en escritorio');
  await ready(page);
  await page.keyboard.press('n');
  await page.getByLabel('Nombre').fill('Por teclado');
  await page.getByLabel('Nombre').press('Enter');
  await expect(page.locator('.items')).toContainText('Por teclado');
  await page.locator('body').click({ position: { x: 5, y: 300 } });
  await page.keyboard.press('Control+z');
  await expect(page.getByRole('heading', { name: 'Tu mapa está vacío' })).toBeVisible();
  await page.keyboard.press('Control+Shift+z');
  await expect(page.locator('.items')).toContainText('Por teclado');
});
