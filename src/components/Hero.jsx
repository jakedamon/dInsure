import React from 'react'
import styled from 'styled-components'

function Hero() {
    return (
        <Container>
            <Text>
                <div className='main-text'>
                    <p>Peer to Peer <span>blockchain based</span> Car Insurance</p>
                </div>
                <div className='buttons'>
                    <div className='plan-pricing'>
                        <p>Plan</p>
                        <div className='for-arrow'>
                            <img src="/images/long-white.png"/>
                        </div>
                    </div>
                </div>
            </Text>
            <Image>
                <div className='bgImg'>
                    <img src='/images/Vector.png' />
                </div>
                <div className='car'>
                    <img src='/images/sports-car.png' />
                </div>
            </Image>
        </Container>
    )
}

export default Hero

const Container = styled.div`
    margin-top: 5rem;
    height: 90vh;
    width: 100%;
    padding-left: 13.2rem;
    display: flex;
`

const Text = styled.div`
    width: 35rem;
    display: flex;
    flex-direction: column;
   

    .main-text {
        flex:1.4;
        display: flex;
        align-items: end;
        p {
            margin: 0;
            font-size: 65px;
            font-weight: 400;
            margin-bottom: 10px;
            letter-spacing: 3px;

            span {
                color: #0153b5;
                
            }
        }
    }

    .buttons {
        flex:1;
        display: flex;
        justify-content: start;
   
        .plan-pricing {
            cursor: pointer;
            margin-top: 3rem;
            width: 10rem;
            height: 3rem;
            background-color: #0153b5;
            display: flex;
            justify-content: center;
            align-items: center;
            border-radius: 100px;
            color: white;
            font-size: 20px;
            transition: opacity 0.15s;
            &:hover {
                opacity: 0.9;
            }

            .for-arrow {
                width: 50px;
                display: flex;
                justify-content: center;
                align-items: center;

                img {
                    margin-top: 1px;
                    width: 100%;
                    margin-left: 15px;
                }
        }
        }

       

    }
`
const Image = styled.div`
    flex: 1;
    position: relative;

    .bgImg {
        height: 100%;
        width: 100%;
        display: flex;
        align-items: center;
        padding-left: 19rem;
      
        img {   
            margin-top: -9rem;
            width: 71%;
         }
    }

    .car {
        position: absolute;
        top: 4rem;
        right: 10rem;
        display: flex;
        justify-content: center;

      
 
        img {
            margin-left: -5rem;
            width: 100%;
        }
    }

   
`