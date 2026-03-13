import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOProps {
    title?: string;
    description?: string;
    image?: string;
    url?: string;
    type?: 'website' | 'article' | 'restaurant' | 'product';
    venueName?: string;
}

export const SEO: React.FC<SEOProps> = ({
    title,
    description = "Rescatto — Salva comida deliciosa y ayuda al planeta. Rescata packs sorpresa de tus restaurantes favoritos a precios increíbles.",
    image = "https://rescatto.app/og-image.png", // Replace with real production URL
    url = "https://rescatto.app",
    type = 'website',
    venueName
}) => {
    const siteName = "Rescatto";
    const fullTitle = title ? `${title} | ${siteName}` : `${siteName} — Salva comida, ayuda al planeta`;

    return (
        <Helmet>
            {/* Standard metadata */}
            <title>{fullTitle}</title>
            <meta name="description" content={description} />
            {venueName && <meta name="author" content={venueName} />}

            {/* Open Graph / Facebook */}
            <meta property="og:type" content={type} />
            <meta property="og:url" content={url} />
            <meta property="og:title" content={fullTitle} />
            <meta property="og:description" content={description} />
            <meta property="og:image" content={image} />
            <meta property="og:site_name" content={siteName} />

            {/* Twitter */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:url" content={url} />
            <meta name="twitter:title" content={fullTitle} />
            <meta name="twitter:description" content={description} />
            <meta name="twitter:image" content={image} />

            {/* Theme Color */}
            <meta name="theme-color" content="#10b981" />
        </Helmet>
    );
};

export default SEO;
