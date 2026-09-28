# Sheer Veil Plastic — Framer Component

A cinematic, interactive sheer-curtain effect for Framer, built with WebGL and a lightweight cloth simulation. The curtain reacts to pointer movement, supports center-opening interactions, and reveals an image through translucent fabric with procedural folds, highlights, weave, and grain.

## Preview

[Live Demo](https://sheerveilplastic.framer.website/)

## Features

- Real-time WebGL fabric rendering
- Procedural cloth simulation with physical-style folds
- Split or single curtain panels
- Pointer-driven fabric distortion
- Cinematic silk sheen and lighting
- Image reveal through translucent fabric
- Five ready-made visual presets
- Click, hover, submit, or manual opening
- Automatic close timing
- Procedural weave texture
- Optional film grain
- Responsive canvas sizing
- Device-pixel-ratio capped for performance
- IntersectionObserver pauses rendering when off-screen
- WebGL resource cleanup on unmount
- Static renderer support for Framer Canvas and export
- No external runtime dependencies beyond React and Framer

## Presets

### Organza
The fully customizable preset. Individual silk, sheen, backdrop, sheerness, wind, cursor, lighting, weave, and grain controls remain active.

### Ivory
Warm ivory fabric with soft cinematic lighting.

### Pearl
Cool pearl fabric with brighter highlights and a cleaner finish.

### Smoke
Dark translucent fabric with stronger movement and cursor lighting.

### Midnight
Deep charcoal fabric with dramatic highlights and a darker atmosphere.

## Controls

| Control | Description |
| --- | --- |
| Preset | Select a ready-made visual style. |
| Image | Choose the image revealed behind the curtain. |
| Silk | Set the primary fabric color. |
| Sheen | Control silk highlights and reflections. |
| Backdrop | Set the background color behind the effect. |
| Sheerness | Control the apparent transparency of the fabric. |
| Folds | Set the number of physical-style folds. |
| Panels | Choose Split or Single curtain construction. |
| Wind | Control continuous simulated airflow. |
| Cursor Force | Control pointer-driven fabric distortion. |
| Light Angle | Change the direction of the main fabric light. |
| Room Light | Control ambient illumination. |
| Cursor Glow | Control the moving highlight around the pointer. |
| Open On | Open using Submit, Click, Hover, or Never. |
| Open | Manually control the curtain state. |
| Close After | Automatically close after opening. |
| Weave | Add a procedural textile pattern. |
| Grain | Add subtle film grain. |

## Framer Setup

1. Create or open a Framer project.
2. Add the component as a Code Component.
3. Paste the component source into a TSX file.
4. Place the component on the page.
5. Add an image if you want a photographic reveal.
6. Use the Preset control for a quick starting point.
7. Use the Organza preset when you want complete visual control.
8. Set Open On to Click, Hover, or Submit depending on the interaction you want.

For submit-triggered reveals, the component listens for form submission events and opens when Open On is set to Submit.

## Performance

The component uses a responsive WebGL canvas with a capped device-pixel ratio. Rendering is paused while the component is outside the viewport, and WebGL resources, observers, listeners, textures, buffers, and animation frames are released when the component unmounts.

Framer's static renderer is also handled explicitly. In static rendering contexts, the component does not initialize the WebGL simulation and instead renders a lightweight static fallback suitable for Canvas and export.

## Browser Support

Requires a browser with WebGL support. If WebGL is unavailable, the component exits cleanly without starting the renderer.

## Source

[GitHub Repository](https://github.com/karimsaif0/Sheer-Veil-Plastic-Framer-Component-)

## Live Preview

[https://sheerveilplastic.framer.website/](https://sheerveilplastic.framer.website/)

## Creator

Made with 💛 by Karim Saif.

- X: [@karimsaif0](https://x.com/karimsaif0)
- Email: [karimsaif010@gmail.com](mailto:karimsaif010@gmail.com)
- GitHub: [karimsaif0](https://github.com/karimsaif0)

## Support

For questions, bug reports, or Framer implementation support, contact Karim Saif through X or email.

## License

This repository contains the component source for use with Framer. Please review the repository owner's licensing terms before redistributing or reselling the source.