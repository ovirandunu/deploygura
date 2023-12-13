import React from 'react';

type Props = {pdf_url: string};

const PDFViewer = ({ pdf_url }: Props) => {
    return (
        <iframe 
            src={`https://docs.google.com/gview?url=${encodeURIComponent(pdf_url)}&embedded=true`} 
            // src='pdf_url'
            className='w-full h-full'
        ></iframe>
    )
}

export default PDFViewer;
