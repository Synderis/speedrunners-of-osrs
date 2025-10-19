for i in [0, 180, 181, 182, 183, 184]:
    print(i, i % 4)
    if i % 4 != 0:
        print("Adjusting", i, "to", i + (4 - (i % 4)))
    print('\n')