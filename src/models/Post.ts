import mongoose from 'mongoose'

export type PostDocument = mongoose.Document & {
    urlName: string
    imageUrl: string
    text: string
}

const postSchema = new mongoose.Schema({
    urlName: {type: String, index: true},
    imageUrl: String,
    text: String
})

export const Post = mongoose.model<PostDocument>('Post', postSchema)