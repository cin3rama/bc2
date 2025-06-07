'use client';

import Layout from '../layout';
// import AnimatedRadialLogo from '@/components/AnimatedRadialLogo';
import dynamic from 'next/dynamic';

// const Sentiment = () => {
//     return (
//         <Layout>
//             <div className="p-4">
//                 <h2 className="text-2xl font-bold mb-2">News & Social Sentiment</h2>
//                 <p className="mb-6">Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
//
//                 {/* Test the radial component here */}
//                 <div className="flex justify-center items-center">
//                     <AnimatedRadialLogo />
//                 </div>
//             </div>
//         </Layout>
//     );
// };
//
// export default Sentiment;
// sentiment.tsx

const AnimatedRadialLogo = dynamic(() => import('@/components/AnimatedRadialLogo'), {
    ssr: false, // <-- disables server-side rendering for this component
});

export default function Sentiment() {
    return (
        <div>
            <h2>News & Social Sentiment</h2>
            <AnimatedRadialLogo />
        </div>
    );
}

