'use client'
import { uploadToS3 } from '@/lib/s3'
import { useMutation } from '@tanstack/react-query'
import axios from 'axios'
import { Inbox, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React from 'react'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'



const FileUpload = () => {

    const router = useRouter();

    const [uploading, setUploading] = React.useState(false);

    const { mutate, isPending } = useMutation({
        mutationFn: async ({file_key, file_name}: {file_key: string, file_name: string}) => {
                const response = await axios.post('/api/create-chat', {file_key, file_name}, {timeout: 60000});
                return response.data;
        }
    })

    // Convert `status` to `isLoading`
    // const isLoading = status === 'success';

    const {getRootProps, getInputProps} = useDropzone({
        accept: { 'application/pdf': ['.pdf'] },
        maxFiles: 1,

        //define behavior upon upload
        onDrop: async (acceptedFiles) => {
            console.log(acceptedFiles);
            const file = acceptedFiles[0];

            // file size commparison (!>10MB)
            if (file.size > 10 * 1024 * 1024) {
                //use toast react library to display error message
                toast.error('File too large');
                alert('Please upload a smaller file');
                return;
            }

            //enclose upload success logic in try catch block
            try {
                setUploading(true);
                //upload file to s3
                const data = await uploadToS3(file);
                if (!data?.file_key || !data?.file_name) {
                    alert('Error uploading file');
                    return;
                }
                mutate(data, {
                    onSuccess: ({chat_id}) => {
                        toast.success('Chat created!');
                        router.push(`/chat/${chat_id}`);
                    },
                    onError: (error) => {
                        toast.error('Error creating chat');
                        console.log(error);
                    },
                })
            } catch (error) {
                console.log(error); 
            } finally {
                setUploading(false);
            }
        }
    })
    return (
        <div className='p-2 bg-white rounded-xl'>
            <div {...getRootProps({
                className: 'border-dashed border-2 rounded-x1 cursor-pointer bg-gray-50 py-8 flex justify-center items-center flex-col'
            })} >
                <input {...getInputProps()} /> 
                {uploading || isPending ? (
                    <>
                        {/* loading state */}
                        <Loader2 className='h-10 w-10 text-blue-500 animate-spin' />
                        <p className = 'mt-2 text-sm text-slate-400'>
                            Spilling tea to GPT... 
                        </p>
                    </>
                ) : (
                    <>
                        <Inbox className='w-10 h-10 text-blue-500' />	
                        <p className='mt-2 text-sm text-slate-400'>Drop your PDF here!</p>
                    </>
                )}
            </div>
        </div>
    )
}

export default FileUpload

