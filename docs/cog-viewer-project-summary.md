# Experiment: Building 3D terrain directly from Cloud Optimized GeoTIFFs

Following several conversations at the UC in San Diego—mainly with people working in earth observation, surveying, and defense—I wanted to explore a topic that came up repeatedly: the growing adoption of Cloud Optimized GeoTIFFs across the geospatial community.

A COG remains a standard GeoTIFF, but its internal tiles and overviews allow compatible applications to retrieve only the required area and resolution using HTTP byte-range requests.

This can reduce data transfer, avoid downloading complete raster files, and—in suitable workflows—remove the need to publish the data through a dedicated raster or imagery service.

**What I built**

I created an experimental 3D web viewer using the ArcGIS Maps SDK for JavaScript. It turns selectable collections of SwissALTI3D elevation COGs into continuous 3D terrain surfaces.

The catalog covers Zermatt, Zürich, and the Graubünden municipalities of Chur, Parpan, Vaz/Obervaz, and Lenz. The four municipal catalogs are also available as one combined, de-duplicated catalog containing 245 unique COGs.

**How it works**

- The browser accesses the COGs directly from cloud storage.
- When the 3D view requests a terrain tile, the application identifies the intersecting 1 km COG files.
- It reads only the required pixel windows.
- Their elevation values are combined in memory and supplied to a custom ArcGIS elevation layer.
- COG readers are loaded and cached on demand, while seams and no-data areas are preserved.

There is no pre-generated regional mosaic or separate elevation service. The terrain remains in Swiss LV95 (EPSG:2056), so no coordinate reprojection is needed.

**Why this is interesting**

COGs are often associated with displaying satellite or aerial imagery, but the format supports general georeferenced raster data—including digital elevation models.

This experiment demonstrates how the same partial-access model can be used to construct a dynamic 3D terrain surface directly in the browser.

It does not mean that COGs replace imagery services in every situation. A service can still be valuable when dynamic reprojection, processing, styling, mosaicking, or controlled access is required.

🔗 [Open the Raster Terrain Lab](https://raster-terrain-lab.gianluca-miele.chatgpt.site)  
💻 [Application repository on GitHub](https://github.com/gmiele/raster-terrain-cog-adapter-arcgis-js-sdk)  
📖 Technical documentation: `docs/3d-cog-viewer.md`

### 🤖 How I built it: the AI-assisted workflow

I used **ChatGPT, Codex, and Sites** throughout the project—not only to generate code, but to support the complete workflow: exploring the idea, implementing the application, testing it, creating documentation, and deploying it.

What stood out for me:

- The seamless connection between **UI/UX, code, and browser feedback**, which made visual and functional iteration very efficient.
- Codex worked directly with the **local project files**, producing real code, tests, diagrams, and documentation that remained reviewable and trackable in GitHub.
- The working mode supported longer, iterative tasks—from investigation and planning through implementation and validation.
- Sites provided a smooth path from the working project to an automatically deployed and shareable application.

My main takeaway was the continuity of the process:

**idea → code → visual result → validation → documentation → deployed application**

It felt like an integrated, human-guided development workflow rather than a collection of isolated AI-generated outputs.
