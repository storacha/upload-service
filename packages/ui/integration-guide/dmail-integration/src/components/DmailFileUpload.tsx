import React, { useState } from 'react'
import { Uploader, useUploader } from '@storacha/ui-react'

interface DmailFileUploadProps {
  dmailEmail: string
  onFileUploaded: (fileInfo: FileUploadInfo) => void
}

interface FileUploadInfo {
  cid: string
  fileName: string
  fileSize: number
  dmailShareUrl: string
}

export function DmailFileUpload({ dmailEmail, onFileUploaded }: DmailFileUploadProps) {
  const { files, isUploading, progress, startUpload } = useUploader()
  const [uploadedFiles, setUploadedFiles] = useState<FileUploadInfo[]>([])

  const handleUploadComplete = async (result: any) => {
    const fileInfo: FileUploadInfo = {
      cid: result.cid.toString(),
      fileName: files[0]?.name || 'Unknown',
      fileSize: files[0]?.size || 0,
      dmailShareUrl: `https://dmail.ai/share/${result.cid}`
    }

    setUploadedFiles(prev => [...prev, fileInfo])
    onFileUploaded(fileInfo)

    // Simulate Dmail notification
    console.log('Dmail notification sent:', {
      to: dmailEmail,
      subject: 'File Uploaded to Storacha',
      body: `Your file "${fileInfo.fileName}" has been uploaded successfully.`,
      fileCid: fileInfo.cid
    })
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      // This would be handled by the Uploader component
      console.log('Files selected:', Array.from(e.target.files))
    }
  }

  return (
    <div className="dmail-file-upload">
      <div className="upload-header">
        <h3>Upload Files</h3>
        <p>Connected as: {dmailEmail}</p>
      </div>

      <Uploader
        onUploadComplete={handleUploadComplete}
        className="dmail-upload-tool"
      >
        <div className="upload-section">
          <div className="dmail-dropzone">
            <div className="dropzone-content">
              <div className="upload-icon">📁</div>
              <h4>Drag & Drop Files</h4>
              <p>Upload files to Storacha and share via Dmail</p>
              <div className="supported-formats">
                <span>Images, Videos, Documents, Archives</span>
              </div>
              <input
                type="file"
                multiple
                onChange={handleFileSelect}
                style={{ display: 'none' }}
                id="file-input"
              />
              <label htmlFor="file-input" className="file-input-label">
                Choose Files
              </label>
            </div>
          </div>

          {files && files.length > 0 && (
            <div className="selected-files">
              <h4>Selected Files:</h4>
              {files.map((file, index) => (
                <div key={index} className="file-item">
                  <span className="file-name">{file.name}</span>
                  <span className="file-size">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
              ))}
            </div>
          )}

          {isUploading && (
            <div className="upload-progress">
              <h4>Uploading...</h4>
              <div className="progress-bar">
                <div 
                  className="progress-fill"
                  style={{ width: `${progress.percentage || 0}%` }}
                />
              </div>
              <p>{progress.percentage || 0}% complete</p>
            </div>
          )}

          <div className="upload-actions">
            <button
              onClick={startUpload}
              disabled={!files || files.length === 0 || isUploading}
              className="dmail-upload-button"
            >
              {isUploading ? 'Uploading...' : 'Upload & Share via Dmail'}
            </button>
          </div>
        </div>
      </Uploader>

      {uploadedFiles.length > 0 && (
        <div className="uploaded-files">
          <h4>Uploaded Files</h4>
          {uploadedFiles.map((file, index) => (
            <div key={index} className="uploaded-file-item">
              <div className="file-info">
                <span className="file-name">{file.fileName}</span>
                <span className="file-size">{(file.fileSize / 1024 / 1024).toFixed(2)} MB</span>
              </div>
              <div className="file-actions">
                <a
                  href={file.dmailShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="dmail-share-link"
                >
                  Open in Dmail
                </a>
                <button
                  onClick={() => navigator.clipboard.writeText(file.dmailShareUrl)}
                  className="copy-link-button"
                >
                  Copy Link
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
