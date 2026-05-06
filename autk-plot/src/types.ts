
import type { FeatureCollection, GeoJsonProperties, Geometry } from 'geojson';

import { PlotEvent } from './constants';

export type PlotMargins = { left: number; right: number; top: number; bottom: number };
export type PlotPrimitive = string | number | boolean | null | undefined | number[] | string[];
export type PlotDatum = Record<string, PlotPrimitive>;
export type PlotInputData =
    | FeatureCollection<Geometry, GeoJsonProperties>
    | PlotDatum[];

export type ParallelCoordinatesNormalizationMode = 'none' | 'minmax' | 'robust' | 'zscore';

export type ParallelCoordinatesConfig = {
    normalization?: {
        mode?: ParallelCoordinatesNormalizationMode;
        quantileClamp?: [number, number];
    };
};

export type PlotConfig = {
    div: HTMLElement, 
    data: PlotInputData,
    events: PlotEvent[],
    margins?: PlotMargins,
    width?: number,
    height?: number,
    labels?: { axis: string[]; title: string },
    parallelCoordinates?: ParallelCoordinatesConfig
}

export type PlotEventListener = (selection: number[]) => void;

export type ColorHEX = `#${string}`;
export type ColorRGB = { r: number; g: number; b: number; opacity: number };
export type ColorTEX = number[];
