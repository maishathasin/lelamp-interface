# lelamp interface 

#how to run 

```
npm i 

npm run dev

```

# How to run for lelamp 

Please upload the simulation folder as a .zip file, it should have all the meshes and robot.URDF

# Whats been done 

- Joints + transition nodes for the Lelamp 
- URDF loader with selection and node based selection and movement 
- Node state is tracked and run using Zustand
- animation flow, when nodes are connected, you can run the animation and see changes in the URDF file 
- Upload a CSV of keyframes and it should animate 


# Needs to be improved and implemented 
- When uploading the URDF file, the orientation its being placed at is wrong, have to double check if we are mapping the joints correctly, because when uploading the animation file, the orientation is very different 
- Have export as keyframes in a CSV 
- This needs to interface with lelamp run time for rgb service 
- needs calibration 


