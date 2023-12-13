import { PineconeClient, Vector, utils as PineconeUtils } from '@pinecone-database/pinecone';
import { downloadFromS3 } from './s3-server';
import {PDFLoader} from 'langchain/document_loaders/fs/pdf'
import {Document, RecursiveCharacterTextSplitter} from '@pinecone-database/doc-splitter'
import { metadataKey } from 'aws-sdk/clients/health';
import { getEmbeddings } from './embeddings';
import md5 from 'md5'
import { FileKey } from 'lucide-react';
import { convertToAscii } from './utils';

let pinecone: PineconeClient | null = null

export const getPineconeClient = async () => {
    if (!pinecone) {
        pinecone = new PineconeClient()
        await pinecone.init({
            environment: process.env.PINECONE_ENVIRONMENT!,
            apiKey: process.env.PINECONE_API_KEY!
        })
    }
    return pinecone
}

// define pdf class structure
type PDFPage = {
    pageContent: string;
    metadata: {
        loc: {pageNumber:number}
    }
}


// take pdf from s3, preprocess and upload to pinecone
export async function loadS3IntoPinecone(fileKey: string) {
    //1. obtain the pdf -> download and read text
    console.log('downloading s3 into file system')
    const file_name = await downloadFromS3(fileKey);
    
    if (!file_name) {
        throw new Error('Could not download file from S3')
    }  
    const loader = new PDFLoader(file_name);
    const pages = (await loader.load()) as PDFPage[];
    

    // 2. Split and preprocess pdf into segments
    const documents = await Promise.all(pages.map(prepareDocument));

    // 3. vectorise and embed individual documents
    const vectors = await Promise.all(documents.flat().map(embedDocument))

    // 4. upload to pinecone
    const client = await getPineconeClient()
    const pineconeIndex = client.Index('gura')
    

    console.log('inserting vectors into pinecone' + fileKey)
    const namespace = convertToAscii(fileKey)
    console.log(namespace)
    PineconeUtils.chunkedUpsert(pineconeIndex, vectors, namespace, 10)
    console.log('finished inserting vectors into pinecone')
    return documents[0]
}

// function to embed document
async function embedDocument(doc: Document) {
    try {
        const embeddings = await getEmbeddings(doc.pageContent)
        const hash = md5(doc.pageContent)

        return{
            id: hash,
            values: embeddings,
            metadata: {
                text: doc.metadata.text,
                pageNumber: doc.metadata.pageNumber 
            }
        } as Vector
    } catch (error) {
        console.log('error embedding document', error)
        throw error;    
    }
}

// function to truncate strings by bytes to fit pinecone parameters
export const truncateStringByBytes = (str: string, bytes: number) => {
    const enc = new TextEncoder()
    return new TextDecoder('utf-8').decode(enc.encode(str).slice(0, bytes))
}

// prepare document for step 2
async function prepareDocument(page: PDFPage) {
    let {pageContent, metadata} = page
    pageContent = pageContent.replace(/\n/g, '')
    // split the docs
    const splitter = new RecursiveCharacterTextSplitter()
    const docs = await splitter.splitDocuments([
        new Document({
            pageContent,
            metadata: {
                pageNumber: metadata.loc.pageNumber,
                text: truncateStringByBytes(pageContent, 36000)
            }
        })
    ])
    return docs
}