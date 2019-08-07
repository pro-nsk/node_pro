import mongoose from "mongoose";

export type PostDocument = mongoose.Document & {
    url: string;
};

const postSchema = new mongoose.Schema({
    url: String,
});

export const Post = mongoose.model<PostDocument>("Post", postSchema);