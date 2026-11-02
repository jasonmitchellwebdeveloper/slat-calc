import { useEffect, useMemo, useRef, useState } from "react";
import type { FenceLayout } from "@/engine/calculate";
import type { Design } from "@/engine/types";
import { Button } from "../Button/Button";
import { SceneUnavailable } from "../SceneUnavailable/SceneUnavailable";
import { buildFenceModel } from "./fenceModel";
import styles from "./FenceScene.module.scss";
import { createFenceStage, type FenceStage } from "./fenceStage";

interface FenceSceneProps {
  design: Design;
  layout: FenceLayout;
  colourHex: string;
  frameHex: string;
  label: string;
}

const ROTATE_STEP = Math.PI / 8;

export function FenceScene({
  design,
  layout,
  colourHex,
  frameHex,
  label,
}: FenceSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<FenceStage | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const model = useMemo(
    () => buildFenceModel(design, layout),
    [design, layout],
  );

  useEffect(() => {
    let stage: FenceStage;
    try {
      stage = createFenceStage(containerRef.current!, () =>
        setUnavailable(true),
      );
    } catch {
      // Only runs once, when WebGL can't start, so there's no cascade to avoid.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUnavailable(true);
      return;
    }
    stageRef.current = stage;
    return () => {
      stageRef.current = null;
      stage.dispose();
    };
  }, []);

  useEffect(() => {
    stageRef.current?.setModel(model, colourHex, frameHex);
  }, [model, colourHex, frameHex]);

  useEffect(() => {
    stageRef.current?.setLabel(label);
  }, [label]);

  if (unavailable) return <SceneUnavailable />;

  return (
    <div className={styles.scene}>
      <div ref={containerRef} className={styles.canvas} />
      <div className={styles.controls}>
        <Button onClick={() => stageRef.current?.rotate(-ROTATE_STEP)}>
          Rotate left
        </Button>
        <Button onClick={() => stageRef.current?.rotate(ROTATE_STEP)}>
          Rotate right
        </Button>
        <Button onClick={() => stageRef.current?.resetView()}>
          Reset view
        </Button>
      </div>
    </div>
  );
}
