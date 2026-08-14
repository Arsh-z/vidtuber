import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.models.js"
import {uploadOnCLoudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"

const generateAccessAndRefereshToken = async (userId) => {
    try {
        const user = await User.findById(userId)
        //small check for user existense
    
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()
    
        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })
        return {accesstoken, refreshToken}
    } catch (error) {
      throw new ApiAError(500, "Something went wrong while generating and refresh tokens") 
        
    }
}

const registerUser = asyncHandler(async (req, res) => {

    const { fullname, email, username, password } = req.body
    
    //validation
    if (
      [fullname, username, email, password].some(
        (field) => field?.trim() === ""
      )
    ) {
      throw new ApiError(400, "all fields are required");
    }

    const existedUser = await User.findOne({
        $or:[{username},{email}]
    })

    if (existedUser) {
        throw new ApiError(409,'User with email or username already exists')
    }


    console.warn(req.files)
    const avatarLocalPath = req.files?.avatar?.[0]?.path
    const coverLocalPath = req.files?.coverImage?.[0]?.path

    if (!avatarLocalPath) {
        throw new ApiError(400,'Avatar file is missing')
    }
    // const avatar = await uploadOnCLoudinary(avatarLocalPath)
    // let coverImage = ""

    // if (coverLocalPath) {
    //     coverImage = await uploadOnCLoudinary(coverImage)
        
    // }
    
    let avatar;
    try {
        avatar = await uploadOnCLoudinary(avatarLocalPath)
        console.log("Uploaded avatar",avatar)
    } catch (error) {
        console.log("Error uploading avatar", error) 
        throw new ApiError(500, "Failed to upload avatar");
    }
    
    let coverImage;
    try {
      coverImage = await uploadOnCLoudinary(coverLocalPath);
      console.log("Uploaded coverImage", coverImage)
    } catch (error) {
      console.log("Error uploading coverImage", error);
      throw new ApiError(500, "Failed to upload coverImage");
    }



    const user = await User.create({
      fullname,
      avatar: avatar.url,
      coverImage: coverImage?.url || "",
      email,
      password,
      username: username.toLowerCase(),
    });


    const createdUser = await User.findById(user._id).select("-password -refreshToken"

    )

    if (!createdUser) {
        throw new ApiError(500,"Something went wrong while registring a user")
    }
    
    return res.status(201).json(new ApiResponse(200,createdUser,"User registed successfully "))
})

const loginUser = asyncHandler(async (req, res) => {
    //get data from body
    const { email, username, password } = req.body
    
    //validation
    if (!email) {
        throw new ApiError(409,"Email is required")
    }

    const user = await User.findOne({
      $or: [{ username }, { email }],
    })

    if (!user) {
        throw new ApiError(404, "User not found")
    }

    //validation password

    const isPasswordValid = await user.isPasswordCorrect(password)
    
    if (!isPasswordValid) {
        throw new ApiError(401,"Invslid credentials")
    }

    const { accessToken, refreshToken } = await generateAccessAndRefereshToken(user._id)
    
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production"
    }

    return res
        .status(200)
        .cookie("accessToken", accessToken, option)
        .cookie("refreshToken", refreshToken, option)
        .json(new ApiResponse(
            200,
            { user: loggedInUser, accessToken, refreshToken },
            "User logged in successfully"
        ))

})

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
               refreshToken: undefined,
           }
        },
        {new:true} 
    )

    const options = {
        httpOnly: true,
        secure : process.env.NODE_ENV === "production"
    }

    return res.status(200)
        .clearCookie("accesssToken",options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200,{},"User logged out successfully"))
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookie.refreshToken || req.body.refreshToken

    if (!incomingRefreshToken) {
        throw new ApiError(401, " Refresh token is required")
    }

    try {
        const decodedToken =jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
        const user = await User.findById(decodedToken?._id)
        
        if (!user) {
            throw new ApiError(401, "Invalid refresh token")
        }    

        if (incomingRefreshToken !== user?.refreshAccessToken) {
            throw new ApiError(401, "Invalid refresh token")
        }
        
        const options = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "productiion",
            
        }

        const { accessToken, refreshToken: newRefreshtoken } = await generateAccessAndRefereshToken; (user._id)
        
        return res
          .status(200)
          .cookie("accessToken", accessToken, option)
          .cookie("refreshToken", newRefreshtoken, option)
            .json(
                new ApiResponse(
                200,
                { accessToken, refreshToken: newRefreshtoken },
                "Acccess token refreshed successfully"
          ))
        

    } catch (error) {
        throw new ApiError(500,"Something went wrong while refreshing access token")
    }
})

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body
    
    const user = await User.findById(req.user?._id)
    
    const isPasswordValid = await user.isPasswordCorrect(oldPassword)

    if (!isPasswordValid) {
        throw new ApiError(401,"old password is incorrect")
    }

    user.password = newPassword;

    await user.save({ validateBeforeSave: false })
    
    return res.status(200).json(new ApiResponse(200, {}, "Password changed succesfully"))
    
});

const getCurrentPassword = asyncHandler(async (req, res) => {
    return res
      .status(200)
      .json(new ApiResponse(200,req.user , "Current user details"));
})

const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullname, email } = req.body
    
    if (!fullname) {
        throw new ApiError (400,"Fullname is required")
    }
    if (!email) {
        throw new ApiError(400,"email is required")
    }


    const user = await User.findByIdAndUpdate(
        req.user?._ID,
        {
            $set: {
                fullname,
                email:email
            }
        },
        {new:true}
    ).select("-password -refreshToken")

    return res
      .status(200)
      .json(new ApiResponse(200, req.user, "Account detailed update successfully"));
})

const updateUserAvatar = asyncHandler(async (req, res) => { 
    const avatarLocalPath = req.files?.path

    if (!avatarLocalPath) {
        throw new ApiError (400,"file is required")
    }

    const avatar = await uploadOnCLoudinary(avatarLocalPath)

    if (!avatar.url) {
        throw new ApiError(500, "something went wrong while uploading avatar")
        

    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $SET: {
                avatar: avatar.url
            }
        },
        {new: true}
    ).select("-password -refreshToken")

    return res.status(200).json(new ApiResponse(200,user,"Avatar Updated Successfully"))

})

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;

  if (!coverImageLocalPath) {
    throw new ApiError(400, "File is required");
  }

  const coverImage = await uploadOnCLoudinary(coverImageLocalPath);

  if (!coverImage.url) {
    throw new ApiError(500, "something went wrong while uploading avatar");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $SET: {
        avatar: coverImage.url,
      },
    },
    { new: true }
  ).select("-password -refreshToken");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover image Updated Successfully"));
});

const getUserChannelProfile = asyncHandlerr(async (req, res) => {
    const { username } = req.params
    
    if (!username?.trim()) {
        throw new ApiError(400,"Username is required")
    }

    const channel = await User.aggregate(
        [
            {
                $match: {
                    username: username?.toLowerCase()
                }
            },
            {
                $lookup: {
                    from: "subscription",
                    localField: "_id",
                    foreignField: "channel",
                    as: "subscribers"

                }
            },
            {
                $lookup: {
                    from: "subscription",
                    localField: "_id",
                    foreignField: "subscriber",
                    as:"subscriberedTo"
                }
            },
            {
                $addFields: {
                    subscriberCount: {
                        $size: "$subscribers"
                    },
                    channelsSubscribedToCount: {
                        $size:"$subscriberedTo"
                    },
                    isSubscribed: {
                        $cond: {
                            if: { $in: [req.user?._id, "$subscribers.subscriber"] },
                            then: true,
                            else: false
                        }
                    }
                }
            },
            {
                //Project only te necessary data
                $project: {
                    fullname: 1,
                    username: 1,
                    avatar: 1,
                    subscribersCount: 1,
                    channelsSubscribedToCount: 1,
                    isSubscribed: 1,
                    coverImage: 1,
                    email:1
                        
                    
                },

            }
        ]          
    )

    if (!channel?.length) {
        throw new ApiError(404,"Channel not found")
    }

    return res.status(200).json(new ApiResponse(
        200,
        channel[0],
        "channel profile fetched successfully"
    ))
})

const getWatchHistory = asyncHandler(async (req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user?._id)
            }
        },
        {
            $lookup: {
                from: "video",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullname: 1,
                                        username: 1,
                                        avatar:1
                                    }
                                }
                            ]
                        }

                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }

    ])

    return res.status(200).json(new ApiResponse(
        200,
        user[0]?.watchHistory, "Watch history fetched successfully"
    ))
})
    


export {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
  changeCurrentPassword,
  getCurrentPassword,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
  getWatchHistory
};