import express from 'express';
import { User } from '../models/user.js';

const router  = express.Router()

// getting all kycs
router.get('/', async(req, res) => {
  try {
    const kycs = await Kyc.find().sort({ _id: -1 });
    res.send(kycs)
  } catch (x) { return res.status(500).send({message: "Something Went Wrong..."}) }
})


// getting a kyc
router.get('/:id', async(req, res) => {
  const { id } = req.params
  try {
    const kyc = await Kyc.findById(id)
    if (!kyc) return res.status(404).send({message: "Kyc not found..."})
    res.send(kyc);
  } catch(e){ for(i in e.errors) res.status(500).send({message: e.errors[i].message}) }
})


// creating a kyc
router.post('/', async (req, res) => {
  const { name, email, kyc } = req.body;
  const { error } = validateKyc(req.body);

  if (error) return res.status(400).send({message: error.details[0].message});
  console.log(req.body)

  // check if kyc already exists
  let userKyc = await Kyc.findOne({ $or: [{email}, {kyc}] })
  if (userKyc) return res.status(400).send({message: 'Kyc already exists'});

  const newKyc = new Kyc({ name, email, kyc });
  try {
    const result = await newKyc.save();
    res.send(result);
  }
  catch (e) { for(i in e.errors) res.status(500).send({message: e.errors[i].message}) 
}

});


// approving a kyc
router.put('/', async (req, res) => {
  const { email, kyc } = req.body;

  
  try {
    let user = await User.findOne({ email });
    let userKyc = await Kyc.findOne({ $or: [{email}, {kyc}] })
    if (!user) return res.status(404).send({message: "User not found..."})
    if (!userKyc) return res.status(404).send({message: "Kyc not found..."})
    
    userKyc.status = true;
    user.idVerified = true;
    console.log(userKyc, user)

    await Promise.all([user.save(), userKyc.save()]);
    res.send({message: "Kyc sent successfully and pending approval..."});
  } catch (e) { for(i in e.errors) res.status(500).send({message: e.errors[i].message}) }
});


export default router;