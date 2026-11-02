import { Calculator } from "@/components/Calculator/Calculator";
import styles from "./page.module.scss";

export default function Home() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Slatwise</h1>
        <p>Fence calculator. Specs and prices are illustrative.</p>
      </header>
      <main className={styles.main}>
        <Calculator />
      </main>
    </div>
  );
}
