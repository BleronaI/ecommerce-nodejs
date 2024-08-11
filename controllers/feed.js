const fs = require('fs')
const path = require('path')

const { validationResult } = require('express-validator')

const io = require('../socket')
const Post = require('../models/post')
const User = require('../models/user')


exports.getPosts = async (req, res, next) => {
  const currentPage = req.query.page || 1;
  const perPage = 2;

  try {
    const totalItems = await Post.count();
    const posts = await Post.findAll({
      order: [['createdAt', 'DESC']],
      offset: (currentPage - 1) * perPage,
      limit: perPage,
      include: [{ model: User, attributes: ['name'] }]
    })

    res.status(200).json({
      message: 'Fetched posts successfully.',
      posts: posts,
      totalItems: totalItems
    })
  } catch (err) {
    if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
  }

//   Post.count() 
//     .then(count => {
//       totalItems = count;
//       return Post.findAll({
//         offset: (currentPage - 1) * perPage,
//         limit: perPage,
//         include: [{ model: User, attributes: ['name'] }]
//       });
//     })
//     .then(posts => {
//       res.status(200).json({
//         message: 'Fetched posts successfully.',
//         posts: posts,
//         totalItems: totalItems
//       });
//     })
//     .catch(err => {
//       if (!err.statusCode) {
//         err.statusCode = 500;
//       }
//       next(err);
//     });


};






exports.createPost = async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const error = new Error('Validation failed, entered data is incorrect.');
        error.statusCode = 422;
        throw error;
      }
      if (!req.file) {
        const error = new Error('No image provided.');
        error.statusCode = 422;
        throw error;
      }
      const imageUrl = req.file.path.replace("\\", "/");
      const title = req.body.title;
      const content = req.body.content;
      
      const createdPost = await Post.create({
        title: title,
        content: content,
        imageUrl: imageUrl,
        userId: req.userId
      });
  
      const creator = await User.findByPk(req.userId);      
      await creator.addPost(createdPost);
  
      io.getIO().emit('posts', { action: 'create', post: createdPost })
      res.status(201).json({
        message: 'Post created successfully!',
        post: createdPost,
        creator: { id: creator.id, name: creator.name }
      });
    } catch (err) {
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    }


  // const errors = validationResult(req);
  // if (!errors.isEmpty()) {
  //   const error = new Error('Validation failed, entered data is incorrect.');
  //   error.statusCode = 422;
  //   throw error;
  // }
  // if (!req.file) {
  //   const error = new Error('No image provided.');
  //   error.statusCode = 422;
  //   throw error;
  // }
  // const imageUrl = req.file.path.replace("\\", "/");
  // const title = req.body.title;
  // const content = req.body.content;
  // let creator;
  // let createdPost; 

  // Post.create({
  //   title: title,
  //   content: content,
  //   imageUrl: imageUrl,
  //   userId: req.userId
  // })
  //   .then(post => {
  //     createdPost = post; 
  //     return User.findByPk(req.userId);
  //   })
  //   .then(user => {
  //     creator = user;
  //     return user.addPost(createdPost); 
  //   })
  //   .then(result => {
  //     res.status(201).json({
  //       message: 'Post created successfully!',
  //       post: createdPost, 
  //       creator: { id: creator.id, name: creator.name }
  //     });
  //   })
  //   .catch(err => {
  //     if (!err.statusCode) {
  //       err.statusCode = 500;
  //     }
  //     next(err);
  //   });
};







exports.getPost = async (req, res, next) => {
  try {
    const postId = req.params.postId;
    const post = await Post.findByPk(postId, {
      include: [{ model: User, attributes: ['name'] }]
    });

    if (!post) {
      const error = new Error('Could not find post.');
      error.statusCode = 404;
      throw error;
    }

    res.status(200).json({
      message: 'Post fetched',
      post: post
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }



  // const postId = req.params.postId;
  // Post.findByPk(postId, {
  //   include: [{ model: User, attributes: ['name'] }] 
  // })
  //     .then(post => {
  //       if(!post) {
  //         const error = new Error('Could not find post.');
  //         error.statusCode = 404;
  //         throw error;
  //       }
  //       console.log(post)
  //       res.status(200).json({message: 'Post fetched', post: post });
  //     })
  //     .catch(err => {
  //       if(!err.statusCode) {
  //         err.statusCode = 500;
  //       }
  //       next(err);
  //     });
}







exports.updatePost = async (req, res, next) => {
  try {
    const postId = req.params.postId;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error = new Error('Validation failed, entered data is incorrect.');
      error.statusCode = 422;
      throw error;
    }
    
    const title = req.body.title;
    const content = req.body.content;
    let imageUrl = req.body.image;
    if (req.file) {
      imageUrl = req.file.path.replace("\\", "/");
    }
    if (!imageUrl) {
      const error = new Error('No file picked.');
      error.statusCode = 422;
      throw error;
    }

    const post = await Post.findByPk(postId);
    if (!post) {
      const error = new Error('Could not find post.');
      error.statusCode = 404;
      throw error;
    }

    if (String(post.userId) !== String(req.userId)) {
      const error = new Error('Not authorized to edit this post.');
      error.statusCode = 403;
      throw error;
    }
    if (imageUrl !== post.imageUrl) {
      clearImage(post.imageUrl);
    }

    post.title = title;
    post.imageUrl = imageUrl;
    post.content = content;
    const updatedPost = await post.save();

    const user = await User.findByPk(req.userId);
    if (!user) {
      const error = new Error('User not found.');
      error.statusCode = 404;
      throw error;
    }
    io.getIO().emit('posts', { action: 'update', post: updatedPost });
    res.status(200).json({
      message: 'Post updated!',
      post: updatedPost,
      creator: { id: user.id, name: user.name }
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }





  // const postId = req.params.postId;
  // const errors = validationResult(req);
  // if (!errors.isEmpty()) {
  //   const error = new Error('Validation failed, entered data is incorrect.');
  //   error.statusCode = 422;
  //   throw error;
  // }
  // const title = req.body.title;
  // const content = req.body.content;
  // let imageUrl = req.body.image;
  // if (req.file) {
  //   imageUrl = req.file.path.replace("\\", "/");
  // }
  // if (!imageUrl) {
  //   const error = new Error('No file picked.');
  //   error.statusCode = 422;
  //   throw error;
  // }

  // let fetchedUser;
  // let updatedPost;
  // Post.findByPk(postId)
  //   .then(post => {
  //     if (!post) {
  //       const error = new Error('Could not find post.');
  //       error.statusCode = 404;
  //       throw error;
  //     }

  //     if (String(post.userId) !== String(req.userId)) {
  //       const error = new Error('Not authorized to edit this post.');
  //       error.statusCode = 403;
  //       throw error;
  //     }

  //     if (imageUrl !== post.imageUrl) {
  //       clearImage(post.imageUrl);
  //     }
  //     post.title = title;
  //     post.imageUrl = imageUrl;
  //     post.content = content;
  //     return post.save();
  //   })
  // .then(result => {
  //   updatedPost = result;
  //   return User.findByPk(req.userId);
  // })
  //   .then(user => {
  //     if (!user) {
  //       const error = new Error('User not found.');
  //       error.statusCode = 404;
  //       throw error;
  //     }
  //     fetchedUser = user;
  //     res.status(200).json({
  //       message: 'Post updated!',
  //       post: updatedPost,
  //       creator: { id: fetchedUser.id, name: fetchedUser.name }
  //     });
  //   })
  //   .catch(err => {
  //     if (!err.statusCode) {
  //       err.statusCode = 500;
  //     }
  //     next(err);
  //   });
};



exports.deletePost = async (req, res, next) => {
  try{
    const postId = req.params.postId;
    const post = await Post.findByPk(postId)
      if(!post) {
          const error = new Error('Could not find post.');
          error.statusCode = 404;
          throw error;
        }
      if (String(post.userId) !== String(req.userId)) {
          const error = new Error('Not authorized to edit this post.');
          error.statusCode = 403;
          throw error;
        }
        clearImage(post.imageUrl)
        const result = await post.destroy();
        io.getIO().emit('posts', { action: 'delete', post: 'postId'})
        res.status(200).json({ message: 'Deleted post.'})
  }
  catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }

  // const postId = req.params.postId;
  // Post.findByPk(postId) 
  //   .then(post => {
  //     if(!post) {
  //       const error = new Error('Could not find post.');
  //       error.statusCode = 404;
  //       throw error;
  //     }
  //     if (String(post.userId) !== String(req.userId)) {
  //       const error = new Error('Not authorized to edit this post.');
  //       error.statusCode = 403;
  //       throw error;
  //     }
  //     clearImage(post.imageUrl)
  //     return post.destroy();
  //   })
  //   .then(result => {
  //     console.log(result);
  //     res.status(200).json({ message: 'Deleted post.'})
  //   })
  //   .catch(err => {
  //     if(!err.statusCode) {
  //       err.statusCode = 500;
  //     }
  //     next(err);
  //   });
}


const clearImage = filePath => {
  filePath = path.join(__dirname, '..' , filePath)
  fs.unlink(filePath, err => console.log(err))
}