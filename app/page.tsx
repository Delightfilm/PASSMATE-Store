import type { Metadata } from "next";
import { LearningHome } from "@/components/learning-home";
import { HOME_TITLE, HOME_DESCRIPTION, publicMetadata } from "@/lib/seo";

export const metadata: Metadata = publicMetadata(HOME_TITLE, HOME_DESCRIPTION, "/");

export default function Home() { return <LearningHome />; }
