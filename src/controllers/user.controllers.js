import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.models.js"
import {uploadOnCLoudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"

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

export { registerUser, loginUser };