import type {Metadata} from 'next';
import {privateMetadata} from '@/lib/seo';
import {AnalyticsSettings} from '@/components/analytics-settings';
export const metadata:Metadata={...privateMetadata,title:'방문 분석 설정 | PASSMATE'};
export default function AnalyticsSettingsPage(){return <AnalyticsSettings/>;}
