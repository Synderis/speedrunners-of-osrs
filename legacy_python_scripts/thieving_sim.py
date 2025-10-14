import math
import random
import statistics

LockpickSuccessRate = 0.8203
NoLockpickSuccessRate = 0.6094
NoLockpickSuccessRate = (1.0 + int((((99.0 * (99.0 - 99)) / 98.0) + 
                                   ((155.0 * (99 - 1.0)) / 98.0) + 0.5))) / 256.0

LeftTurningInitialTicks = [11,13,14,16,18]
StraightInitialTicks = [16,17,18,19,20]
RightTurningInitialTicks = [18,29,20,21,22]

LeftTurningSubsequentTicks = [8,11,13,16,18]
StraightSubsequentTicks = [9,11,13,15,17]
RightTurningSubsequentTicks = [5,8,11,13,15]

def thieveChest(lockpick):
    SuccessRate = NoLockpickSuccessRate
    if lockpick == True:
        SuccessRate = LockpickSuccessRate
    opened = 0
    time = 0
    while opened == 0:
        time += 2
        if random.uniform(0,1) < SuccessRate:
            opened = 1
    NumberOfGrubs = 2
    if random.uniform(0,1)<0.25:
        NumberOfGrubs = 3
    return time, NumberOfGrubs

def simulation(InitialChests, SubsequentChests, Lockpick):
    time = 0
    eatingTicksRemaining = 90
    dumped = 0
    #Calculate how many ticks until the first dump, as well as how many grubs to dump
#CHANGE HERE FOR OTHER CONFIGURATIONS
    timeUntilDump = StraightInitialTicks[InitialChests-2]
    initialGrubs = 0
    for i in range(InitialChests):
        timeUntilDump += thieveChest(Lockpick)[0]
        initialGrubs += thieveChest(Lockpick)[1]
    time += timeUntilDump
    dumped += initialGrubs
    #Now we've dumped some grubs and added that time on, next we need to do subsequent
    #dumps until dumped = 30
    while dumped < 30:
#CHANGE HERE FOR OTHER CONFIGURATIONS
        subsequentTimeUntilDump = StraightSubsequentTicks[SubsequentChests-2]
        subsequentGrubs = 0
        for i in range(SubsequentChests):
            subsequentTimeUntilDump += thieveChest(Lockpick)[0]
            subsequentGrubs += thieveChest(Lockpick)[1]
        time += subsequentTimeUntilDump
        eatingTicksRemaining = max(0,90-3*dumped,eatingTicksRemaining - subsequentTimeUntilDump)
        dumped += subsequentGrubs
    #we only reach this point once at least 30 grubs have been dumped
    #once we reach here, there will still be some ticks of eating left
    #this is given by 'eatingTicks', we just add this on to the end
    time += eatingTicksRemaining
    return(time)

for i in range(5):
    for j in range (5):
        sims = []
        for k in range (100000):
            sims.append(simulation(i+2,j+2,False))
        print(i+2,j+2,statistics.mean(sims))