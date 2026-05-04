import "./globals.css";

export const metadata = {
  title: "Meta Swipe",
  description: "Dashboard local para explorar anúncios, páginas, buscas e Raindrop.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
