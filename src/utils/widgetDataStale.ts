/**
 * Flag set by web when widget-relevant data (check-in, shared playlist, etc.) has changed.
 * When app goes to background, we trigger widget refresh so the widget extension refetches from API.
 */

let widgetDataStale = false;

export const getWidgetDataStale = (): boolean => widgetDataStale;

export const setWidgetDataStale = (value: boolean): void => {
  widgetDataStale = value;
};
