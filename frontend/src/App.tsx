import { AuthProvider } from "./context/AuthContext";
import { DropPage } from "./pages/DropPage";

export default function App() {
  return (
    <AuthProvider>
      <DropPage />
    </AuthProvider>
  );
}
