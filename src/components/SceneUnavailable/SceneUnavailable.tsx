import styles from "./SceneUnavailable.module.scss";

export function SceneUnavailable() {
  return (
    <p className={styles.message} role="status">
      The 3D view isn&apos;t available right now. The 2D plan shows everything
      you need.
    </p>
  );
}
