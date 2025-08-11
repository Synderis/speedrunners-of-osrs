import numpy as np
import matplotlib.pyplot as plt
import random as random
import math
import statistics
from tabulate import tabulate

#   This is a sample of the Markov model for killing times for mobs in OSRS
#   These Wiki pages are very good on the maths:
#   https://en.wikipedia.org/wiki/Absorbing_Markov_chain
#   https://en.wikipedia.org/wiki/Discrete-time_Markov_chain

#   Sample case: imagine an NPC with 50hp and we're hitting with a whip
#   We start with a 1x51 matrix which is the state space of our NPC, state n means the NPC has lost n health
#   Each entry corresponds to the probability of the NPC being in that state, so they'll sum to 1
#   The first column of the 1x51 matrix is state 0, which means 0 damage has been dealt
#   The final column of the 1x51 matrix is state 50, which means 50 damage has been dealt, ie NPC is dead
#   This is an ABSORBING state, and we're concerned with the expected number of steps before being absorbed
#   We consider a 51x51 transition matrix, which governs how one hit from a weapon/thrall will change the NPC state
#   If we start with a 1x51 probability distribution of the NPC state, and multiple by the 51x51 transition matrix
#   Then the resulting 1x51 matrix is the probability distribution of the NPC state AFTER the hit has been applied
#   I'll cover more of the theory later, but for now, we want to construct matrices for different hits

#   First, we construct the matrix for a single whip hit, with accuracy a, max hit m and monster hp given by hp
#   The probability that the state doesn't change is simply (1-a), so this should be along every diagonal
#   Imagine the NPC is in state (1, 0, 0, ..., 0), i.e. it has 50hp with 100% certainty
#   If it takes a whip hit, there's a (1-a) chance it remains on 50hp, and an a/m chance it gets hit 1, 2, ..., m
#   So the first row of the transition matrix should be (1-a, a/m, a/m, ..., a/m, 0, 0, ..., 0)
#   I.e. there's one (1-a), followed by m entries of (m/a), then the rest are zeros
#   Similarly row two will be the same, but shifted one to the right - it will be upper diagonal
#   When we get to 48hp, there's a (1-a) chance of staying on 48hp, an a/m chance of 49, and an a(m-1)/m of 50
#   When we get to 49hp, there's a (1-a) chance of staying on 49hp, and an (a) chance of going to 50hp
#   Actually algorithmically, this is easy to figure out these edge cases, we can make the final column always
#   be equal to 1 minus the sum of the previous entries in that row
#   So to generate the matrix, we will:
#       For each row x, make each entry zero until we reach column x
#       Make column x be equal to (1-a)
#       Make each entry after that be equal to (a/m) until column x+m
#       On column 51 make the entry equal to 1 minus the sum of all previous entries
#       Repeat on the next row
#   For now I haven't included the fact that zeros on succeeded accuracy checks re-roll as a 1
#   but that's easy to add in

np.set_printoptions(precision=3,suppress=True)

def SingleMatrix(a, m, hp):
    
    #make an empty (hp+1)x(hp+1) matrix
    matrix = np.zeros((hp+1,hp+1), dtype=float)

    #outer loop to iterate over rows
    for i in range(hp+1):
        
        #inner loop to iterate over columns
        for j in range(hp+1):

            #set elements of this row equal to (1-a) if we're on the diagonal
            if j == i and j != hp:
                matrix[i,j] = 1-a

            #set elements of this row equal to (a/m) if we're past the diagonal but before i+m
            if j > i and j <= i+m and j != hp:
                matrix[i,j] = a/m

            #set final element of this row equal to 1 minus the sum of all previous elements in the row
            if j == hp:
                matrix[i,j] = 1-np.sum(matrix[i,:])

    return matrix

#   This matrix now returns a transition matrix corresponding to one hit from a weapon
#   Try printing the line below to see what this looks like
#   print(singleMatrix(0.6,4,8))
#   You can see the diagonal entries are all 0.4, corresponding to the chance of missing
#   Then there's a 0.15 chance of hitting 1/2/3/4 damage each, which would move you onto the next states
#   Towards the end of the matrix, the probabilities add up, e.g. going from 7 to 8 hp can be done by hitting
#   either 1, 2, 3 or 4 damage, so the total probability is 0.60

#   The SingleMatrix function then gives us a np array of the transition matrix, which we can use for matrix maths
#   The most basic example of what we can do with this is to see what the probability of an NPC being dead after n
#   hits is
#   First, we need a function to initialise an NPC's state with hp given by hp

def NPCState(hp):
    matrix = np.zeros((1,hp+1))
    matrix[0,0] = 1
    return matrix

#   This just gives a (1)x(hp+1) matrix of (1,0,0,...,0), so it starts on full hp (state 0) with 100% certainty
#   The below code will generate an NPC with hp given by hp, then hit it noHits times with a weapon with a max hit
#   of maxHit, and an accuracy of acc, and will return the state space of the NPC at the end

def HittingBasicNPC(hp,maxHit,acc,noHits):

    #Initialise starting state of NPC
    state = NPCState(hp)

    #Generate transition matrix for our given weapon characteristics
    transitionMatrix = SingleMatrix(acc, maxHit, hp)

    #Apply the transition matrix to the state space the number of times specified (hit boss n times)
    for i in range(noHits):
        state = np.matmul(state,transitionMatrix)

    #Output the final state space of the NPC
    return state

#   This function then gives us a distribution of possible states after n hits for a given NPC
#   The line below gives the distribution of NPC states for an NPC with 10hp, after it's taken 8 hits from a
#   weapon with a max hit of 4 and an accuracy of 0.5
#   print(HittingBasicNPC(10,4,0.5,8))
#   We can see there's a 0.53 chance it's dead (last column), a 0.092 chance it's on 1hp, etc.
#   This is a completely deterministic distribution of states after n hits

#   What we really want is the distribution of probabilities of being dead for different numbers of hits
#   We can calculate these individually by taking the final value of the above state, for different values of noHits

def DistributionOfHitsToKill(hp,maxHit,acc, cap):

    #Create an array to store our probability distribution of kill times
    matrix = np.array([])

    #We want the iteration to stop once probability of death is greater than a cap, so we need a counter
    count = 0

    #We also need to iterate up through different numbers of hits
    i = 0
    
    #Iterate until the probability of death is above our cap, 0.99
    while count < cap:
        #Initialise state and transition matrix
        state = NPCState(hp)
        transitionMatrix = SingleMatrix(acc,maxHit,hp)
        
        for j in range(i):
            state = np.matmul(state,transitionMatrix)

        #Put the probability of death as the i-th entry in our output matrix, also update the count and iterator
        matrix = np.append(matrix, state[0,hp])
        count = state[0,hp]
        i += 1

    return matrix

#   This function gives us a distribution of probabilities of being dead by n hits, where n is the nth entry
#   For example, the line of code below gives the probability distribution of number of hits required to kill
#   an NPC with 50hp, when using a 50% accurate weapon with a max hit of 10. The simulation will stop once
#   the probability of death reaches 0.999
#   print(DistributionOfHitsToKill(50,10,0.5,0.999))
#   print(DistributionOfHitsToKill(50,10,0.5,0.999)[15])
#   We can see there's a 0.262 chance of being dead after 15 hits

#   We can also allow for thralls, thralls have a transition matrix equal to a single hitting weapon with accuracy
#   0.75 and a max hit of 3 (in the current function which doesn't allow for 0s rolling as 1s, again this is easily
#   adaptable). E.g. the function below gives the thrall transition matrix for an npc with 10hp
#   print(SingleMatrix(0.75,3,10))

#   Hopefully it's clear this is correct - then we can calculate total kill times by generating a tick operating
#   system and allowing for different hits on different ticks. For example, set up a counter to go from tick 0 up
#   and if it reaches a multiple of 4, apply the thrall transition matrix, if it reaches a multiple of 5, apply
#   the scythe transition matrix, and then we can again extract the probability of death for each tick by checking
#   in on the current state's (hp)-th entry

def WeaponAndThrallKillTimes(hp,maxHit,acc,cap):

    #Initialise the starting NPC state, weapon transition matrix and the thrall transition matrix
    state = NPCState(hp)
    weapon = SingleMatrix(acc,maxHit,hp)
    thrall = SingleMatrix(0.75,3,hp)

    #Create an array to store our probability distribution of kill times for each tick, make a count to check the
    #cap and also a tick counter to iterate over
    matrix = np.array([])
    count = 0
    tick = 0

    while count < cap:
        #Increment the number of ticks by 1
        tick += 1
        
        #Do a weapon hit every 5th tick (assume you attack first tick)
        if tick % 5 == 1:
            state = np.matmul(state,weapon)

        #Do a thrall hit every 4th tick (assume thrall hits 2nd tick)
        if tick % 4 == 2:
            state = np.matmul(state,thrall)
        
        #Add the probability of being dead in the current state to the output matrix
        matrix = np.append(matrix, state[0,hp])
        count = state[0,hp]
    # print(matrix)

    return matrix

#   This gives a probability distribution of death by tick n where n is the n-th entry
#   In the example below, the distribution of kill times for an NPC with 50hp is plotted when we have thralls
#   as well as a single hitting 5t weapon with max hit of 10, 50% accuracy

#   values = WeaponAndThrallKillTimes(50,10,0.5,0.99)
#   plt.plot(np.arange(values.size),values, '-o')
#   plt.show()

#   You can see the step changes where thralls and/or weapons hit, and the syncing over time!
#   Adding a venge hit in here would just be another matrix multiplied somewhere in the middle
#   We could also pull out the data into a useful table format, e.g. with the below function

def table(array):

    matrix = np.empty((0,2))

    for i in range(array.size):
        b = np.array([i,array[i]])
        matrix = np.vstack((matrix,b))

    return tabulate(matrix, headers=['Tick','Prob(death)'])

# basehp = 450
# secondhp = 350
# thirdhp = 250
#   The below function will print out the kill times in table format
print(table(WeaponAndThrallKillTimes(hp=450,maxHit=70,acc=0.7,cap=0.99)))
# print(table(WeaponAndThrallKillTimes(hp=secondhp,maxHit=10,acc=0.5,cap=0.99)))
# print(table(WeaponAndThrallKillTimes(hp=thirdhp,maxHit=10,acc=0.5,cap=0.99)))

#   Extensions:
#       Adding a scythe distribution matrix, can also do fang too, all other weapons will be single hitting variants
#       Update for not rolling 0s (easy to do)
#       Can amend for confliction gauntlets by adding a check for whether the last state changed or not
#       then we can have dynamic transition matrices for maging









