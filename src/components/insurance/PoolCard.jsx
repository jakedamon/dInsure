import React, { useEffect, useState } from 'react'
import styled from 'styled-components'
import copy from 'copy-to-clipboard';
import { poolAbi, mockUsdcContractAddress, mockUsdcAbi, policyAbi, policyContractAddress } from "../../config";
import { ToastContainer, toast } from 'react-toastify';
import { useAccount } from 'wagmi'
import { ethers } from "ethers"
import web3modal from "web3modal"
import axios from "axios";
import ClipLoader from "react-spinners/ClipLoader";
import fromExponential from 'from-exponential';
import { Web3Storage } from 'web3.storage';
import QRCode from 'qrcode';


function PoolCard(props) {

    const timestamp = require('unix-timestamp');

    const { address } = useAccount();
    const [isStaking, setIsStaking] = useState(false);
    const [poolBalance, setPoolBalance] = useState();
    const [poolName, setPoolName] = useState("");
    const [from, setFrom] = useState();
    const [to, setTo] = useState();
    const [poolDetail, setPoolDetail] = useState({
        premium: "",
        memberCount: "",
        vehicle: "",
        cubicCapacity: "",
    })
    const [isMinting, setIsMinting] = useState(false);
    const [nftMetaData, setNftMetadata] = useState({
        user: {
            name: "",
            age: "",
            email: "",
            profileURI: ""
        },
        pool: {
            address: "",
            name: ""
        },
        insurance: {
            vehicle: "",
            cubicCapacity: "",
            premium: {
                amount: "",
                txHash: ""
            },
            period: {
                from: "",
                to: ""
            }
        }
    })


    const copyAddress = () => {
        copy(props.poolAddress);
    }

    const hexToDec = (hex) => parseInt(hex, 16);

    useEffect(() => {
        getMetaData()
        getPoolBalance()
        getDetail()
    }, [props.poolAddress])

    useEffect(() => {
        prepareNftData();
    }, [from, poolDetail, props.name])

    /*------------------------get user insurance metadata--------------------------*/
    const getMetaData = async () => {
        const provider = new ethers.providers.JsonRpcProvider('https://endpoints.omniatech.io/v1/fantom/testnet/public');
        const poolContract = new ethers.Contract(
            props.poolAddress,
            poolAbi.abi,
            provider
        )
        try {
            await poolContract.getUserMetadatURI(address)
                .then((response) => {
                    fetchInfoFromURI(response)
                })
        } catch (error) {
            console.log(error);
        }
    }

    const fetchInfoFromURI = async (uri) => {
        const uriResponse = await axios.get(uri);
        setPoolDetail({
            ...poolDetail,
            premium: uriResponse.data.insurancePremium,
            vehicle: uriResponse.data.vehicleModel,
            cubicCapacity: uriResponse.data.cubicCapacity
        })
    }
    /*----------------------------------------------------------------------------------*/


    /*---------------------get pool balance----------------------*/

    const getPoolBalance = async () => {
        const provider = new ethers.providers.JsonRpcProvider('https://endpoints.omniatech.io/v1/fantom/testnet/public');
        const usdcContract = new ethers.Contract(
            mockUsdcContractAddress,
            mockUsdcAbi.abi,
            provider
        )
        try {
            await usdcContract.balanceOf(props.poolAddress)
                .then((response) => {
                    let bal = hexToDec(response._hex);
                    setPoolBalance(
                        Number(ethers.utils.formatEther(fromExponential(bal))).toFixed(2)
                    );
                })
        } catch (error) {
            console.log(error);
        }
    }

    /*-----------------------------------------------------------*/

    /*------------------------get Pool detail -------------------*/

    const getDetail = async () => {
        const provider = new ethers.providers.JsonRpcProvider('https://endpoints.omniatech.io/v1/fantom/testnet/public');
        const poolContract = new ethers.Contract(
            props.poolAddress,
            poolAbi.abi,
            provider
        )
        try {
            await poolContract.getPoolDetail()
                .then((response) => {
                    let f = hexToDec(response.from._hex);
                    let fromTime = timestamp.toDate(f);
                    let fromString = fromTime.toString();
                    let t = hexToDec(response.to._hex)
                    let toTime = timestamp.toDate(t);
                    let toString = toTime.toString();
                    setFrom(fromString);
                    setTo(toString);
                    setPoolName(response.name);
                })
        } catch (error) {
            console.log(error);
        }
    }

    /*-----------------------------------------------------------*/

    /*-----------------------Stake premium----------------------------------*/
    const stakeHandler = async () => {
        setIsStaking(true);
        const modal = new web3modal({
            cacheProvider: true,
        });

        const connection = await modal.connect();
        const provider = new ethers.providers.Web3Provider(connection);
        const signer = provider.getSigner();

        const usdcContract = new ethers.Contract(
            mockUsdcContractAddress,
            mockUsdcAbi.abi,
            signer
        )

        const value = 1
        const usdcValue = ethers.utils.parseEther(value.toString());

        const transaction = await usdcContract.transfer(
            props.poolAddress,
            usdcValue
        )

        await transaction.wait()
            .then(() => {
                stakeAmount()
            })
            .catch((error) => {
                console.log(error);
            })
    }

    const stakeAmount = async () => {
        const modal = new web3modal({
            cacheProvider: true,
        });

        const connection = await modal.connect();
        const provider = new ethers.providers.Web3Provider(connection);
        const signer = provider.getSigner();
        const poolContract = new ethers.Contract(
            props.poolAddress,
            poolAbi.abi,
            signer
        )

        const create = await poolContract.stake(
            address,
            poolDetail.premium,
        )

        await create.wait()
            .then(() => {
                setIsStaking(false);
                toast.success("Stake Successfull.", {
                    position: toast.POSITION.TOP_CENTER
                });
            }).catch((error) => {
                setIsStaking(false);
                toast.error("Failed to stake!", {
                    position: toast.POSITION.TOP_CENTER
                });
                console.error(error);
            })
    }

    /*----------------------------------------------------------------------*/

    /*-------------------IPFS code to upload nft metadata -------------*/

    const storageKey = process.env.REACT_APP_WEB3_STORAGE;

    const storageClient = () => {
        return new Web3Storage({ token: `${storageKey}` })
    }

    const uploadToIPFS = async (files) => {
        const client = storageClient();
        const cid = await client.put(files);
        return cid;
    }

    const uploadMetaData = async () => {
        const { user, pool, insurance } = nftMetaData;
        const data = JSON.stringify({ user, pool, insurance });
        const files = [
            new File([data], 'nftMetadata.json')
        ]

        const cid = await uploadToIPFS(files);

        const uri = `https://${cid}.ipfs.w3s.link/nftMetadata.json`

        if (cid.length) {
            await uploadQrData(uri);
        } else {
            toast.error("IPFS upload failed!", {
                position: toast.POSITION.TOP_CENTER
            });
        }
    }

    const uploadQrData = async (_uri) => {

        const qrImageData = await toQrCode(_uri);

        const data = JSON.stringify({ qrImageData });
        const files = [
            new File([data], 'qrImage.json')
        ]

        const cid = await uploadToIPFS(files);
        const qrImageUri = `https://${cid}.ipfs.w3s.link/qrImage.json`;

        if (cid.length) {
            await uploadBothUri(_uri, qrImageUri);
        } else {
            toast.error("IPFS upload failed!", {
                position: toast.POSITION.TOP_CENTER
            });
        }
    }

    /*-------------convert uri to qr-code----------------*/
    const toQrCode = async (metaUri) => {
        const qrData = await QRCode.toDataURL(`${metaUri}`);
        return qrData;
    }
    /*---------------------------------------------------*/

    /*------------------------------------------------------------------------*/


    const uploadBothUri = async (metaUri, qrUri) => {

        const uriData = JSON.stringify({ metaUri, qrUri });
        const files = [
            new File([uriData], 'uri.json')
        ]

        const cid = await uploadToIPFS(files)
        const finalUri = `https://${cid}.ipfs.w3s.link/uri.json`;

        if (cid.length) {

            toast.success("Metadata uploaded to IPFS.", {
                position: toast.POSITION.TOP_CENTER
            });

            const modal = new web3modal({
                cacheProvider: true,
            });

            const connection = await modal.connect();
            const provider = new ethers.providers.Web3Provider(connection);
            const signer = provider.getSigner();

            console.log(signer);

            const policyContract = new ethers.Contract(
                policyContractAddress,
                policyAbi.abi,
                signer
            )

            try {
                const tx = await policyContract.createPolicyToken(
                    finalUri,
                    props.poolAddress,
                )

                await tx.wait()
                    .then(() => {
                        console.log("minted!")
                        toast.success("Policy Minted!", {
                            position: toast.POSITION.TOP_CENTER
                        });
                    }).catch((error) => {
                        toast.error("Failed to mint policy!", {
                            position: toast.POSITION.TOP_CENTER
                        });
                        console.error(error);
                    })

            } catch (error) {
                if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
                    setIsMinting(false);
                    toast.error("Recert: Already Minted!", {
                        position: toast.POSITION.TOP_CENTER
                    });
                } else {
                    console.log('should not be printed')
                    setIsMinting(false);
                }
                setIsMinting(false);
            }

        } else {
            toast.error("Metadata upload might have failed.", {
                position: toast.POSITION.TOP_CENTER
            });
        }
    }

    const mintPolicy = async () => {
        setIsMinting(true);
        await uploadMetaData();
        setIsMinting(false);
    }

    const prepareNftData = () => {
        setNftMetadata({
            ...nftMetaData,
            user: {
                name: props.name,
                age: props.age,
                email: props.email,
                address: props.userAddress,
                profileURI: props.profileURI
            },
            pool: {
                address: props.poolAddress,
                name: poolName
            },
            insurance: {
                vehicle: poolDetail.vehicle,
                cubicCapacity: poolDetail.cubicCapacity,
                premium: {
                    amount: poolDetail.premium,
                    txHash: "0xF8E9F063228eb47137101eb863BF3976466AA31F"
                },
                period: {
                    from: from,
                    to: to
                }
            }
        })
    }

    return (
        <Container>
            <div className='pool-name'>
                <div className='pool-name-div'>
                    <p>{poolName}</p>
                </div>
            </div>
            <div className='pool-address'>
                <div className='address'>
                    <p>Address</p>
                </div>
                <div className='text'>
                    <p className='address-text'>
                        {props.poolAddress}
                    </p>
                    <div className='copy' onClick={copyAddress}>
                        <img src="/images/copy.png" />
                    </div>
                </div>
            </div>
            <div className='pool-balance'>
                <div className='address'>
                    <p>Balance</p>
                </div>
                <div className='text'>
                    <p className='address-text'>
                        {poolBalance}
                    </p>
                </div>
            </div>
            <div className='insurance-period'>
                <div className='text-heading'>
                    <p>Period of Insurance</p>
                </div>
                <div className='boxes'>
                    <div className='from-div'>
                        <div className='from'>
                            <p>From</p>
                        </div>
                        <div className='text'>
                            <p className='from-text'>
                                {from?.slice(0, 16)}
                            </p>
                        </div>
                    </div>
                    <div className='to-div'>
                        <div className='to'>
                            <p>To</p>
                        </div>
                        <div className='text'>
                            <p className='to-text'>
                                {to?.slice(0, 16)}
                            </p>
                        </div>
                    </div>
                </div>

            </div>
            <div className='vehicle-detail'>
                <div className='text-heading'>
                    <p>Vehicle Detail</p>
                </div>
                <div className='boxes'>
                    <div className='vehicle-name-div'>
                        <div className='vehicle-name'>
                            <img src="/images/car.png" />
                        </div>
                        <div className='text'>
                            <p className='name-text'>
                                {poolDetail.vehicle}
                            </p>
                        </div>
                    </div>
                    <div className='cubic-capacity-div'>
                        <div className='cc'>
                            <img src="/images/engine.png" />
                        </div>
                        <div className='text'>
                            <p className='cc-text'>
                                {poolDetail.cubicCapacity}cc
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            <div className='premium-count'>
                <div className='boxes'>
                    <div className='premium-div'>
                        <div className='premium'>
                            <p>Premium</p>
                        </div>
                        <div className='text'>
                            <p className='name-text'>
                                $ {poolDetail.premium}
                            </p>
                        </div>
                    </div>
                    <div className='count-div'>
                        <div className='count'>
                            <p>Member</p>
                        </div>
                        <div className='text'>
                            <p className='count-text'>
                                {props.memberCount}/3
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            <div className='stake-amount'>
                <div className='inner' onClick={stakeHandler}>
                    {!isStaking &&
                        <p>Stake $ {poolDetail.premium}</p>
                    }
                    {isStaking &&
                        <ClipLoader color="#ffffff" size={16} />
                    }
                </div>

            </div>
            <div className='status-div' onClick={mintPolicy}>
                {!isMinting &&
                    <p>Mint Policy</p>
                }
                {isMinting &&
                    <ClipLoader color="#ffffff" size={16} />
                }
            </div>
        </Container>
    )
}

export default PoolCard

const Container = styled.div`
    margin-top: 0.7rem;
    width: 100%;
    height: 92%;
    display: flex;
    flex-direction: column;
    background-color: #0152b515;
    border-radius: 8px;
    border: 1px solid #0152b546;
    overflow: hidden;
    color: #202020fb;
    
    .pool-name {
        height: 2.5rem;
        width: 100%;
        background-color: #0152b5b1;
        display: flex;
        justify-content: start;
        align-items: center;
        overflow: hidden;

        .pool-name-div {
            width: 12rem;
            display: flex;
            justify-content: start;
            align-items: center;

            p {
                margin-left:12px;
                font-weight: 500;
                color: white;
            }
        }        
        
        .pool-id {
            flex: 1;
            display: flex;
            justify-content: end;
            align-items: center;
            margin-right: 0.5rem;
            height: 1.8rem;
            border-radius: 6px;
            overflow: hidden;
            border: 1px solid #ffffff52;


            .text {
                flex: 1;
                display: flex;
                
                .pool-text {
                    flex: 1;
                    display: flex;
                    justify-content: start;
                    align-items: center;
                    font-size: 12px;
                    margin-left: 10px;
                    color: #ffffffe8;
                }

                .copy {
                    width: 2.5rem;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    cursor: pointer;
                    transition: background-color 0.15s, opacity 0.15s;

                    img {
                        width: 50%;
                            opacity: 0.7;
                        }

                    &:hover {
                        background-color: #ffffff1c;
                    }

                    &:active {
                        opacity: 0.7;
                    }

                }
            }
            
        }
    }

    

    .pool-address,
    .pool-balance {
        margin-top: 0.6rem;
        display: flex;
        height: 2rem;
        margin-left: 0.5rem;
        margin-right: 0.5rem;
        border-radius: 6px;
        overflow: hidden;
        border: 1px solid #0152b546;

        .address {
            width: 4.1rem;
            border-right: 1px solid #0152b546;
            display: flex;
            justify-content: center;
            align-items: center;
            background-color: #0152b539;

            p {
                margin: 0%;
                font-size: 15px;
            }
        }

        .text {
            flex: 1;
            display: flex;
            
            .address-text {
                flex: 1;
                display: flex;
                justify-content: start;
                align-items: center;
                font-size: 11px;
                margin-left: 10px;
            }

            .copy {
                width: 2.5rem;
                display: flex;
                justify-content: center;
                align-items: center;
                cursor: pointer;
                transition: background-color 0.15s, opacity 0.15s;

                img {
                    width: 50%;
                    opacity: 0.7;
                }

                &:hover {
                    background-color: #0152b539;
                }

                &:active {
                    opacity: 0.7;
                }

             }
        }
    }

    .pool-balance {
        margin-top: 0.9rem;

        .text{
            .address-text {
                font-size: 15px;
            }
        }
    }

    .insurance-period {
        margin-top: 0.7rem;
        display: flex;
        flex-direction: column;
        height: 3.6rem;
        width: 100%;
        margin-left: 0.5rem;
        margin-right: 0.5rem;
        gap: 5px;
        
        .text-heading {
            display: flex;
            height: 1.3rem;
            margin-right: 0.5rem;

            p {
                margin:0;
                font-size:15px;
            }
        }

        .boxes {
            display: flex;
            flex: 1;
            padding-right: 0.5rem;
            gap: 20px;

            .from-div {
                flex: 1;
                display: flex;
                border-radius: 6px;
                overflow: hidden;
                border: 1px solid #0152b546;

                .from {
                    width: 3.5rem;
                    height: 100%;
                    background-color: #0152b539;
                    display: flex;
                    justify-content: start;
                    align-items: center;
                    border-right: 1px solid #0152b546;

                    p {
                        margin:0;
                        margin-left: 10px;
                        font-size: 15px;
                    }
                }

                .text {
                    flex: 1;
                    display: flex;
                    justify-content: start;
                    align-items: center;

                    p {
                        margin:0;
                        margin-left: 10px;
                        font-size: 13px;
                    }
                }
            }

            .to-div {
                flex: 1;
                display: flex;
                border-radius: 6px;
                overflow: hidden;
                border: 1px solid #0152b546;
                margin-right: 0.6rem;

                .to {
                    width: 3.5rem;
                    height: 100%;
                    background-color: #0152b539;
                    display: flex;
                    justify-content: start;
                    align-items: center;
                    border-right: 1px solid #0152b546;

                    p {
                        margin:0;
                        margin-left: 10px;
                        font-size: 15px;
                    }
                }

                .text {
                    flex: 1;
                    display: flex;
                    justify-content: start;
                    align-items: center;

                    p {
                        margin:0;
                        margin-left: 10px;
                        font-size: 13px;
                    }
                }
            }
        }
       
    }

    .vehicle-detail {
        margin-top: 0.7rem;
        display: flex;
        flex-direction: column;
        height: 3.6rem;
        width: 100%;
        margin-left: 0.5rem;
        margin-right: 0.5rem;
        gap: 5px;
        
        .text-heading {
            display: flex;
            height: 1.3rem;
            margin-right: 0.5rem;

            p {
                margin:0;
                font-size:15px;
            }
        }

        .boxes {
            display: flex;
            flex: 1;
            padding-right: 0.5rem;
            gap: 20px;

            .vehicle-name-div {
                flex: 1;
                display: flex;
                border-radius: 6px;
                overflow: hidden;
                border: 1px solid #0152b546;

                .vehicle-name {
                    width: 3.4rem;
                    height: 100%;
                    background-color: #0152b539;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    border-right: 1px solid #0152b546;

                    img {
                        width: 55%;
                        opacity: 0.9;
                    }
                }

                .text {
                    flex: 1;
                    display: flex;
                    justify-content: start;
                    align-items: center;

                    p {
                        margin:0;
                        margin-left: 10px;
                        font-size: 15px;
                    }
                }
            }

            .cubic-capacity-div {
                flex: 1;
                display: flex;
                border-radius: 6px;
                overflow: hidden;
                border: 1px solid #0152b546;
                margin-right: 0.6rem;

                .cc {
                    width: 3.4rem;
                    height: 100%;
                    background-color: #0152b539;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    border-right: 1px solid #0152b546;

                    img {
                        width: 40%;
                        opacity: 0.9;
                    }
                }

                .text {
                    flex: 1;
                    display: flex;
                    justify-content: start;
                    align-items: center;

                    p {
                        margin:0;
                        margin-left: 10px;
                        font-size: 15px;
                    }
                }
            }
        }
    }

    .premium-count {
        margin-top: 1rem;
        height: 2rem;
        width: 100%;
        margin-left: 0.5rem;
        margin-right: 0.5rem;
        gap: 5px;
        overflow: hidden;
        
        .boxes {
            display: flex;
            height: 100%;
            padding-right: 0.5rem;
            gap: 20px;

            .premium-div {
                flex: 1;
                display: flex;
                justify-content: start;
                align-items: center;
                border-radius: 6px;
                overflow: hidden;
                border: 1px solid #0152b546;

                .premium {
                    width: 5.1rem;
                    height: 100%;
                    background-color: #0152b539;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    border-right: 1px solid #0152b546;

                    p {
                        font-size: 15px;
                        margin-left: 3px;
                    }
                }

                .text {
                    flex: 1;
                    display: flex;
                    justify-content: start;
                    align-items: center;

                    p {
                        margin:0;
                        margin-left: 10px;
                        font-size: 15px;
                    }
                }
            }

            .count-div {
                flex: 1;
                display: flex;
                border-radius: 6px;
                overflow: hidden;
                border: 1px solid #0152b546;
                margin-right: 0.6rem;

                .count {
                    width: 5.1rem;
                    height: 100%;
                    background-color: #0152b539;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    border-right: 1px solid #0152b546;

                    p {
                        font-size: 15px;
                        margin-left: 3px;
                    }
                }

                .text {
                    flex: 1;
                    display: flex;
                    justify-content: start;
                    align-items: center;

                    p {
                        margin:0;
                        margin-left: 10px;
                        font-size: 15px;
                    }
                }
            }
        } 
    }

    .stake-amount {
        margin-top: 0.8rem;
        height: 2.2rem;
        margin-left: 0.5rem;
        margin-right: 0.5rem;
        border-radius: 6px;

        display: flex;
        justify-content: center;
        align-items: center;
        overflow: hidden;


        .inner {
            display: flex;
            flex: 1;
            height: 100%;
            justify-content: center;
            align-items: center;
            background-color: #0152b5c3;
            display: flex;
            cursor: pointer;
            transition: opacity 0.15s;

            p {
                margin: 0;
                font-size: 15px;
                color: white;
            }

            &:hover {
                opacity: 0.9;
            }
        }

        
    }

    .status-div {
        margin-top: 0.7rem;
        height: 2.2rem;
        margin-left: 0.5rem;
        margin-right: 0.5rem;
        background-color: #008000d5;
        border-radius: 6px;
        cursor: pointer;
        transform: opacity 0.15s;
        &:hover {
            opacity: 0.9;
        }

        &:active {
            opacity: 0.8;
        }
        display: flex;
        justify-content: center;
        align-items: center;

        p {
            margin: 0;
            font-size: 15px;
            color: white;
        }
    }
`