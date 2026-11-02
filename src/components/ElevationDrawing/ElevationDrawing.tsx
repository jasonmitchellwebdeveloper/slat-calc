import type { CSSProperties } from "react";
import type { FenceLayout } from "@/engine/calculate";
import type { Design } from "@/engine/types";
import styles from "./ElevationDrawing.module.scss";
import { buildElevation, describeElevation } from "./elevationGeometry";

interface ElevationDrawingProps {
  design: Design;
  layout: FenceLayout;
  index: number;
  colourHex: string;
  frameHex: string;
}

// Long runs scroll sideways at this scale instead of shrinking to a thin line.
const MIN_PX_PER_MM = 0.04;
// Below this, a full-size bay label would touch the next one.
const NARROW_BAY_MM = 1100;

export function ElevationDrawing({
  design,
  layout,
  index,
  colourHex,
  frameHex,
}: ElevationDrawingProps) {
  const drawing = buildElevation(design, layout);
  const { fenceSpan, gate, groundY, fenceTopY } = drawing;
  const dimensionY = fenceTopY - 90;
  const heightX = fenceSpan.fromX - 240;

  return (
    <svg
      className={styles.svg}
      viewBox={`0 0 ${drawing.width} ${drawing.height}`}
      role="img"
      aria-label={describeElevation(layout, index)}
      style={
        {
          "--fence-colour": colourHex,
          "--frame-colour": frameHex,
          minWidth: `${Math.round(drawing.width * MIN_PX_PER_MM)}px`,
        } as CSSProperties
      }
    >
      <rect
        className={styles.sky}
        x={fenceSpan.fromX}
        y={fenceTopY}
        width={drawing.posts[drawing.posts.length - 1].x - fenceSpan.fromX}
        height={groundY - fenceTopY}
      />

      {drawing.slats.map((slat) => (
        <rect key={`${slat.x}-${slat.y}`} className={styles.fence} {...slat} />
      ))}

      {drawing.sheets.map((sheet) => (
        <rect key={sheet.x} className={styles.sheet} {...sheet} />
      ))}
      {drawing.rails.map((rail) => (
        <rect key={`${rail.x}-${rail.y}`} className={styles.frame} {...rail} />
      ))}
      {drawing.sleepers.map((sleeper) => (
        <rect key={sleeper.x} className={styles.frame} {...sleeper} />
      ))}

      {gate && (
        <>
          <rect className={styles.gateLeaf} {...gate.leaf} />
          {gate.hinges.map((hinge) => (
            <rect key={hinge.y} className={styles.hinge} {...hinge} />
          ))}
        </>
      )}

      {drawing.posts.map((post) => (
        <rect
          key={post.x}
          className={post.shared ? styles.sharedPost : styles.post}
          x={post.x}
          y={post.y}
          width={post.width}
          height={post.height}
        />
      ))}
      {drawing.basePlates.map((plate) => (
        <rect key={plate.x} className={styles.post} {...plate} />
      ))}

      <line
        className={styles.ground}
        x1={0}
        x2={drawing.width}
        y1={groundY}
        y2={groundY}
      />

      <line
        className={styles.dimension}
        x1={fenceSpan.fromX}
        x2={fenceSpan.toX}
        y1={dimensionY}
        y2={dimensionY}
      />
      <text
        className={styles.label}
        x={(fenceSpan.fromX + fenceSpan.toX) / 2}
        y={dimensionY - 60}
        textAnchor="middle"
      >
        {fenceSpan.lengthMm} mm
      </text>

      <line
        className={styles.dimension}
        x1={heightX}
        x2={heightX}
        y1={fenceTopY}
        y2={groundY}
      />
      <text
        className={styles.label}
        x={heightX - 70}
        y={(fenceTopY + groundY) / 2}
        textAnchor="middle"
        transform={`rotate(-90 ${heightX - 70} ${(fenceTopY + groundY) / 2})`}
      >
        {drawing.fenceHeightMm} mm
      </text>

      {drawing.bays.map((bay) => (
        <text
          key={bay.centreX}
          className={
            bay.widthMm < NARROW_BAY_MM ? styles.narrowLabel : styles.label
          }
          x={bay.centreX}
          y={groundY + 300}
          textAnchor="middle"
        >
          {bay.widthMm} mm
          {bay.cut && (
            <tspan className={styles.cut} x={bay.centreX} dy={260}>
              cut
            </tspan>
          )}
        </text>
      ))}

      {gate && (
        <>
          <line
            className={styles.dimension}
            x1={gate.leaf.x}
            x2={gate.leaf.x + gate.leaf.width}
            y1={dimensionY}
            y2={dimensionY}
          />
          <text
            className={styles.label}
            x={gate.leaf.x + gate.leaf.width}
            y={dimensionY - 340}
            textAnchor="end"
          >
            Gate {gate.widthMm} mm
          </text>
        </>
      )}
    </svg>
  );
}
