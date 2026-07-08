import { Routes, Route, NavLink } from "react-router-dom";
import { Trophy, ClipboardList } from "lucide-react";
import Home from "./pages/Home";
import Quiz from "./pages/Quiz";
import Navbar from "./components/Navbar";



function App() {
  return (
    <div className="min-h-screen bg-[#09090B] text-white">
      {/* Background */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute w-96 h-96 bg-purple-600/20 blur-3xl rounded-full -top-20 -left-20 animate-pulse" />
        <div className="absolute w-96 h-96 bg-blue-600/20 blur-3xl rounded-full bottom-0 right-0 animate-pulse" />
      </div>

      {/* Navbar */}
      <Navbar />

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/quiz" element={<Quiz />} />

        </Routes>
      </main>
    </div>
  );
}

export default App;