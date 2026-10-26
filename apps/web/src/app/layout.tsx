import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
export const metadata:Metadata={title:'FlowNova AI — Automate anything',description:'A thoughtful workspace for building, running, and observing intelligent workflows.'};
export default function RootLayout({children}:{children:React.ReactNode}){const hosted=process.env.VERCEL==='1'&&!process.env.API_ORIGIN;return <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning><body>{hosted&&<aside className="frontend-banner">Hosted demo · Build, publish, and run workflows on Vercel. <Link href="/setup">Runtime details &amp; deployment options →</Link></aside>}{children}</body></html>;}
