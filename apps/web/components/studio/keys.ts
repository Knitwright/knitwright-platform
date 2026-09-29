/** Names for the controls of the editor, used to keep a problem with the control it belongs to. */
export const optionKey = (optionId: string): string => `option:${optionId}`;
export const measurementKey = (pointId: string): string => `measurement:${pointId}`;
export const SIZES_KEY = "sizes:list";
export const BASE_KEY = "sizes:base";
export const colourKey = (panelId: string): string => `colour:${panelId}`;
export const artworkKey = (artworkId: string): string => `artwork:${artworkId}`;
export const NEW_ARTWORK_KEY = "artwork:new";
export const UPLOAD_KEY = "artwork:upload";
