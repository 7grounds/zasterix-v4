 /**
 * @MODULE_ID app.page
 * @DESCRIPTION Root entry point for Origo-V4
 */
import ManagerChat from '../components/ManagerChat';

export default function Home() {
  return (
    <main className="h-screen w-full bg-white">
      <ManagerChat />
    </main>
  );
}
