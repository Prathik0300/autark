import * as d3 from "d3";

import { PlotD3 } from "../plot-d3";
import { ParallelCoordinatesNormalizationMode, PlotConfig } from "../types";
import { PlotStyle } from "../plot-style";
import { PlotEvent } from "../constants";

type NumericalStats = {
    extent: [number, number];
    qLow: number;
    qHigh: number;
    mean: number;
    deviation: number;
};

export class ParallelCoordinates extends PlotD3 {

    protected scales: Map<string, d3.ScaleLinear<number, number> | d3.ScalePoint<string>> = new Map();
    protected axisPositions: d3.ScalePoint<string>;
    protected dimensionTypes: Map<string, 'categorical' | 'numerical'> = new Map();
    protected normalizationMode: ParallelCoordinatesNormalizationMode;
    protected quantileClamp: [number, number];
    protected numericalStats: Map<string, NumericalStats> = new Map();

    constructor(config: PlotConfig) {
        if(config.events === undefined) { config.events = [PlotEvent.CLICK]; }
        super(config);

        this.axisPositions = d3.scalePoint();
        this.normalizationMode = config.parallelCoordinates?.normalization?.mode ?? 'none';
        this.quantileClamp = config.parallelCoordinates?.normalization?.quantileClamp ?? [0.05, 0.95];
        this.draw();
    }

    protected computeNumericalStats(values: number[]): NumericalStats {
        const sorted = [...values].sort((a, b) => a - b);
        const extent = d3.extent(sorted) as [number, number];
        const mean = d3.mean(sorted) ?? 0;
        const deviation = d3.deviation(sorted) ?? 0;
        const qLow = d3.quantileSorted(sorted, this.quantileClamp[0]) ?? extent[0];
        const qHigh = d3.quantileSorted(sorted, this.quantileClamp[1]) ?? extent[1];
        return { extent, qLow, qHigh, mean, deviation };
    }

    protected normalizedNumericalDomain(stats: NumericalStats): [number, number] {
        switch (this.normalizationMode) {
            case 'minmax':
            case 'robust':
                return [0, 1];
            case 'zscore':
                return [-3, 3];
            case 'none':
            default:
                return stats.extent;
        }
    }

    protected normalizeNumericalValue(value: number, stats: NumericalStats): number {
        const safeValue = Number.isFinite(value) ? value : 0;

        switch (this.normalizationMode) {
            case 'minmax': {
                const [min, max] = stats.extent;
                const span = max - min;
                if (span === 0) return 0.5;
                return (safeValue - min) / span;
            }
            case 'robust': {
                const low = stats.qLow;
                const high = stats.qHigh;
                const clamped = Math.max(low, Math.min(high, safeValue));
                const span = high - low;
                if (span === 0) return 0.5;
                return (clamped - low) / span;
            }
            case 'zscore': {
                if (stats.deviation === 0) return 0;
                const z = (safeValue - stats.mean) / stats.deviation;
                return Math.max(-3, Math.min(3, z));
            }
            case 'none':
            default:
                return safeValue;
        }
    }

    protected normalizedTickFormatter(value: number): string {
        if (this.normalizationMode === 'zscore') {
            return `${value.toFixed(1)}σ`;
        }
        if (this.normalizationMode === 'minmax' || this.normalizationMode === 'robust') {
            return `${Math.round(value * 100)}%`;
        }
        return d3.format('.2s')(value);
    }

    protected dimensionSubtitle(dim: string): string {
        const stats = this.numericalStats.get(dim);
        if (!stats || this.normalizationMode === 'none') return '';

        if (this.normalizationMode === 'robust') {
            return `clamped p${Math.round(this.quantileClamp[0] * 100)}-${Math.round(this.quantileClamp[1] * 100)}`;
        }
        if (this.normalizationMode === 'minmax') {
            return `${d3.format('.2s')(stats.extent[0])} to ${d3.format('.2s')(stats.extent[1])}`;
        }
        return `mean ${d3.format('.2s')(stats.mean)}`;
    }

    public async draw(): Promise<void> {
        const hasTitle = this._title && this._title.length > 0;
        const titleBand = hasTitle ? 18 : 0;
        const axisHeaderBand = 26;
        const plotTop = this._margins.top + titleBand + axisHeaderBand;
        const svg = d3
            .select(this._div)
            .selectAll('#plot')
            .data([0])
            .join('svg')
            .attr('id', 'plot')
            .style('width', `${this._width}`)
            .style('height', `${this._height || '500px'}`)
            .style('visibility', 'visible');

        const node = svg.node();

        if (!svg || !node) {
            throw new Error('SVG element could not be created.');
        }

        const width = this._width - this._margins.left - this._margins.right;
        const height = Math.max(80, this._height - plotTop - this._margins.bottom);
        const dimensions = this._axis;

        this.scales.clear();
        this.dimensionTypes.clear();
        this.numericalStats.clear();

        if (hasTitle) {
            svg
                .selectAll<SVGTextElement, string>('#plotTitle')
                .data([this._title])
                .join('text')
                .attr('id', 'plotTitle')
                .attr('class', 'plot-title')
                .attr('x', this._margins.left + width / 2)
                .attr('y', Math.max(this._margins.top * 0.45, 14))
                .attr('text-anchor', 'middle')
                .style('font-size', '13px')
                .style('font-weight', '600')
                .style('visibility', 'visible')
                .text((d) => d);
        }

        dimensions.forEach((dim) => {
            const sampleValues = this.data
                .slice(0, 100)
                .map((d) => d ? d[dim] : null)
                .filter((v) => v !== null && v !== undefined);

            const isNumerical = sampleValues.every((v) => !isNaN(Number(v)));

            if (isNumerical) {
                this.dimensionTypes.set(dim, 'numerical');
                const values = this.data.map((d) => d ? Number(d[dim]) || 0 : 0);
                const stats = this.computeNumericalStats(values);
                this.numericalStats.set(dim, stats);
                this.scales.set(
                    dim,
                    d3.scaleLinear()
                        .domain(this.normalizedNumericalDomain(stats))
                        .range([height, 0])
                );
            } else {
                this.dimensionTypes.set(dim, 'categorical');
                const uniqueValues = Array.from(new Set(this.data.map((d) => d ? String(d[dim]) : 'unknown')));
                this.scales.set(dim, d3.scalePoint<string>().domain(uniqueValues).range([height, 0]).padding(0.5));
            }
        });

        this.axisPositions = d3.scalePoint()
            .domain(dimensions)
            .range([0, width])
            .padding(0.14);

        const foreground = svg
            .selectAll('.autkMarksGroup')
            .data([0])
            .join('g')
            .attr('class', 'autkMarksGroup')
            .attr('transform', `translate(${this._margins.left}, ${plotTop})`);

        foreground
            .selectAll('.autkMark')
            .data(this.data)
            .join('path')
            .attr('class', 'autkMark')
            .attr('d', (d) => this.path(d))
            .style('fill', 'none')
            .style('stroke', PlotStyle.default)
            .style('stroke-width', 1.25)
            .style('opacity', 0.6)
            .style('visibility', 'visible');

        const axisGroups = svg
            .selectAll('.autkBrushable')
            .data(dimensions)
            .join('g')
            .attr('class', 'autkBrushable')
            .attr('transform', (d) => `translate(${this._margins.left + (this.axisPositions(d) || 0)}, ${plotTop})`)
            .style('visibility', 'visible');

        axisGroups.attr('data-dim', (d) => d);

        axisGroups.each((dim, i, nodes) => {
            const scale = this.scales.get(dim);
            const dimType = this.dimensionTypes.get(dim);

            if (scale && dimType === 'numerical') {
                d3.select(nodes[i]).call(
                    d3.axisLeft(scale as d3.ScaleLinear<number, number>)
                        .ticks(this.normalizationMode === 'zscore' ? 7 : 5)
                        .tickFormat((value) => this.normalizedTickFormatter(Number(value))) as any
                );
            } else if (scale && dimType === 'categorical') {
                d3.select(nodes[i]).call(d3.axisLeft(scale as d3.ScalePoint<string>) as any);
            }
        });

        axisGroups
            .append('text')
            .attr('class', 'axis-label')
            .attr('text-anchor', 'middle')
            .attr('y', -11)
            .style('fill', '#000')
            .style('font-size', '12px')
            .style('font-weight', '600')
            .style('visibility', 'visible')
            .text((d) => d);

        axisGroups
            .append('text')
            .attr('class', 'axis-subtitle')
            .attr('text-anchor', 'middle')
            .attr('y', -28)
            .style('fill', '#5d7183')
            .style('font-size', '10px')
            .style('visibility', 'visible')
            .text((d) => this.dimensionTypes.get(d) === 'numerical' ? this.dimensionSubtitle(d) : '');

        foreground
            .selectAll('.autkClear')
            .data([0])
            .join('rect')
            .attr('class', 'autkClear')
            .attr('x', -this._margins.left)
            .attr('y', -plotTop)
            .attr('width', this._width)
            .attr('height', this._height)
            .style('fill', 'transparent')
            .style('visibility', 'visible')
            .lower();

        this.configureSignalListeners();
    }

    protected path(d: any): string {
        const lineGenerator = d3.line<[number, number]>();
        const points: [number, number][] = this._axis.map((dim) => {
            const x = this.axisPositions(dim) || 0;
            const scale = this.scales.get(dim);
            const dimType = this.dimensionTypes.get(dim);

            let y = 0;
            if (scale && dimType === 'numerical') {
                const numScale = scale as d3.ScaleLinear<number, number>;
                const stats = this.numericalStats.get(dim);
                const rawValue = Number(d?.[dim]) || 0;
                const plotValue = stats ? this.normalizeNumericalValue(rawValue, stats) : rawValue;
                y = numScale(plotValue);
            } else if (scale && dimType === 'categorical') {
                const catScale = scale as d3.ScalePoint<string>;
                y = catScale(String(d[dim])) ?? 0;
            }

            return [x, y];
        });

        return lineGenerator(points) || '';
    }

    public updatePlotSelection(): void {
        const lines = d3.selectAll('.autkMark');
        lines
            .style('stroke', (_d: unknown, id: number) => {
                if (this.selection.includes(id)) {
                    return PlotStyle.highlight;
                } else {
                    return PlotStyle.default;
                }
            })
            .style('opacity', (_d: unknown, id: number) => {
                if (this.selection.includes(id)) {
                    return 1;
                } else {
                    return 0.4;
                }
            })
            .style('stroke-width', (_d: unknown, id: number) => {
                if (this.selection.includes(id)) {
                    return 2.5;
                } else {
                    return 1.25;
                }
            });
    }

}
