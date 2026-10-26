import type { NextConfig } from 'next';
import path from 'node:path';
import {withWorkflow} from 'workflow/next';
const config: NextConfig = {
  output: 'standalone',
  distDir: process.env.NEXT_DIST_DIR || '.next',
  outputFileTracingRoot: path.join(__dirname, '../..'),
  async headers() { return [{source:'/:path*',headers:[{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'same-origin'},{key:'X-Frame-Options',value:'DENY'}]}]; }
};
export default withWorkflow(config);
